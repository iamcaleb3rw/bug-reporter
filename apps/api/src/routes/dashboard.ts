import { Hono } from "hono";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { bugReports, projects } from "../db/schema";
import { requireAuth } from "../middleware/require-auth";

export const dashboardRoute = new Hono<{
  Variables: { userId: string };
}>();

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

dashboardRoute.use("*", requireAuth);

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Looks up a project by its public key AND confirms the caller owns it.
 *
 * Returns the project row, or `null` if the project doesn't exist
 * *or* belongs to another user. Deliberately conflates the two cases so
 * an attacker can't probe for valid public keys.
 */
async function getOwnedProject(userId: string, publicKey: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.publicKey, publicKey), eq(projects.ownerId, userId)))
    .limit(1);

  return project ?? null;
}

/* -------------------------------------------------------------------------- */
/* GET /v1/dashboard/overview?project=<publicKey>                             */
/* -------------------------------------------------------------------------- */
/*                                                                            */
/* Returns aggregate counts for a single project: total reports, breakdown    */
/* by status, and basic project metadata.                                     */
/*                                                                            */
/* -------------------------------------------------------------------------- */

dashboardRoute.get("/overview", async (c) => {
  const userId = c.get("userId");
  const publicKey = c.req.query("project");

  if (!publicKey) {
    return c.json({ error: "Missing `project` query parameter." }, 400);
  }

  const project = await getOwnedProject(userId, publicKey);

  if (!project) {
    return c.json({ error: "Project not found." }, 404);
  }

  const [totalRow] = await db
    .select({ value: count() })
    .from(bugReports)
    .where(eq(bugReports.projectId, project.id));

  const byStatus = await db
    .select({
      status: bugReports.status,
      value: count(),
    })
    .from(bugReports)
    .where(eq(bugReports.projectId, project.id))
    .groupBy(bugReports.status);

  const bySeverity = await db
    .select({
      severity: bugReports.severity,
      value: count(),
    })
    .from(bugReports)
    .where(eq(bugReports.projectId, project.id))
    .groupBy(bugReports.severity);

  return c.json({
    project: {
      id: project.id,
      name: project.name,
      publicKey: project.publicKey,
    },
    total: totalRow?.value ?? 0,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.value])),
    bySeverity: Object.fromEntries(
      bySeverity.map((r) => [r.severity, r.value]),
    ),
  });
});

/* -------------------------------------------------------------------------- */
/* GET /v1/dashboard/reports?project=<publicKey>                              */
/* -------------------------------------------------------------------------- */
/*                                                                            */
/* Lists every bug report for one project, newest first.                      */
/*                                                                            */
/* -------------------------------------------------------------------------- */

dashboardRoute.get("/reports", async (c) => {
  const userId = c.get("userId");
  const publicKey = c.req.query("project");

  if (!publicKey) {
    return c.json({ error: "Missing `project` query parameter." }, 400);
  }

  const project = await getOwnedProject(userId, publicKey);

  if (!project) {
    return c.json({ error: "Project not found." }, 404);
  }

  const reports = await db
    .select()
    .from(bugReports)
    .where(eq(bugReports.projectId, project.id))
    .orderBy(desc(bugReports.createdAt));

  return c.json(reports);
});

/* -------------------------------------------------------------------------- */
/* GET /v1/dashboard/reports/:reportId?project=<publicKey>                    */
/* -------------------------------------------------------------------------- */
/*                                                                            */
/* Fetches a single bug report. Requires BOTH the report ID and a project    */
/* query parameter pointing at one of the caller's projects.                 */
/*                                                                            */
/* -------------------------------------------------------------------------- */

dashboardRoute.get("/reports/:reportId", async (c) => {
  const userId = c.get("userId");
  const publicKey = c.req.query("project");
  const reportId = c.req.param("reportId");

  if (!publicKey) {
    return c.json({ error: "Missing `project` query parameter." }, 400);
  }

  const project = await getOwnedProject(userId, publicKey);

  if (!project) {
    return c.json({ error: "Project not found." }, 404);
  }

  const [report] = await db
    .select()
    .from(bugReports)
    .where(
      and(eq(bugReports.id, reportId), eq(bugReports.projectId, project.id)),
    )
    .limit(1);

  if (!report) {
    return c.json({ error: "Report not found." }, 404);
  }

  return c.json(report);
});

/* -------------------------------------------------------------------------- */
/* PATCH /v1/dashboard/reports/:reportId                                      */
/* -------------------------------------------------------------------------- */
/*                                                                            */
/* Update status / severity / priority. Ownership is verified via a join      */
/* through `projects.ownerId`, since the caller may not know the public key   */
/* of the report's project.                                                   */
/*                                                                            */
/* -------------------------------------------------------------------------- */

const updateReportSchema = z
  .object({
    status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.severity !== undefined ||
      data.priority !== undefined,
    { message: "At least one field must be provided." },
  );

dashboardRoute.patch("/reports/:reportId", async (c) => {
  const userId = c.get("userId");
  const reportId = c.req.param("reportId");

  const body = await c.req.json().catch(() => null);

  const parsed = updateReportSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid payload.",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  const patch = parsed.data;

  /* Verify ownership by joining report → project. */
  const [owned] = await db
    .select({ id: bugReports.id })
    .from(bugReports)
    .innerJoin(projects, eq(projects.id, bugReports.projectId))
    .where(and(eq(bugReports.id, reportId), eq(projects.ownerId, userId)))
    .limit(1);

  if (!owned) {
    return c.json({ error: "Report not found." }, 404);
  }

  const now = new Date();

  const resolvedAt =
    patch.status === "resolved" || patch.status === "closed"
      ? now
      : patch.status === "open" || patch.status === "in_progress"
        ? null
        : undefined;

  const [updated] = await db
    .update(bugReports)
    .set({
      ...patch,
      ...(resolvedAt !== undefined ? { resolvedAt } : {}),
      updatedAt: now,
    })
    .where(eq(bugReports.id, reportId))
    .returning();

  return c.json(updated);
});
