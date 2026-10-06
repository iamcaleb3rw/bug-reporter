import { Hono } from "hono";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { bugReports, projects } from "../db/schema";

const bugStatusSchema = z.enum(["open", "in_progress", "resolved", "closed"]);

const bugSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

const bugPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

function assertDashboardEnabled() {
  return process.env.DASHBOARD_DEV_MODE === "true";
}

async function getProject(publicKey: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.publicKey, publicKey))
    .limit(1);

  return project;
}

export const dashboardRoute = new Hono();

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

dashboardRoute.get("/overview", async (c) => {
  if (!assertDashboardEnabled()) {
    return c.json(
      {
        error: "Dashboard development mode is disabled.",
      },
      404,
    );
  }

  const projectKey = c.req.query("project");

  if (!projectKey) {
    return c.json(
      {
        error: "Project is required.",
      },
      400,
    );
  }

  const project = await getProject(projectKey);

  if (!project) {
    return c.json(
      {
        error: "Unknown project.",
      },
      404,
    );
  }

  const reports = await db
    .select({
      status: bugReports.status,
      type: bugReports.type,
      createdAt: bugReports.createdAt,
      resolvedAt: bugReports.resolvedAt,
    })
    .from(bugReports)
    .where(eq(bugReports.projectId, project.id));

  const stats = {
    open: 0,
    inProgress: 0,
    resolved: 0,
    total: reports.length,
  };

  const typeMap = new Map<string, number>();

  for (const report of reports) {
    if (report.status === "open") {
      stats.open += 1;
    }

    if (report.status === "in_progress") {
      stats.inProgress += 1;
    }

    if (report.status === "resolved") {
      stats.resolved += 1;
    }

    typeMap.set(report.type, (typeMap.get(report.type) ?? 0) + 1);
  }

  const days = 30;

  const dates = Array.from({ length: days }, (_, index) => {
    const date = new Date();

    date.setHours(0, 0, 0, 0);

    date.setDate(date.getDate() - (days - 1 - index));

    return date;
  });

  const keyForDate = (date: Date) => date.toISOString().slice(0, 10);

  const openMap = new Map<string, number>();

  const inProgressMap = new Map<string, number>();

  const resolvedMap = new Map<string, number>();

  const volumeMap = new Map<string, number>();

  for (const report of reports) {
    const createdKey = keyForDate(new Date(report.createdAt));

    if (volumeMap.has(createdKey)) {
      volumeMap.set(createdKey, volumeMap.get(createdKey)! + 1);
    } else {
      volumeMap.set(createdKey, 1);
    }

    if (report.status === "open") {
      openMap.set(createdKey, (openMap.get(createdKey) ?? 0) + 1);
    }

    if (report.status === "in_progress") {
      inProgressMap.set(createdKey, (inProgressMap.get(createdKey) ?? 0) + 1);
    }

    if (report.resolvedAt) {
      const resolvedKey = keyForDate(new Date(report.resolvedAt));

      resolvedMap.set(resolvedKey, (resolvedMap.get(resolvedKey) ?? 0) + 1);
    }
  }

  const makeTrend = (map: Map<string, number>) =>
    dates.map((date) => ({
      date: keyForDate(date),
      count: map.get(keyForDate(date)) ?? 0,
    }));

  return c.json({
    project: {
      id: project.id,
      name: project.name,
      publicKey: project.publicKey,
      createdAt: project.createdAt,
    },

    stats: {
      open: {
        total: stats.open,
        trend: makeTrend(openMap),
      },

      inProgress: {
        total: stats.inProgress,
        trend: makeTrend(inProgressMap),
      },

      resolved: {
        total: stats.resolved,
        trend: makeTrend(resolvedMap),
      },

      total: stats.total,
    },

    reportVolume: makeTrend(volumeMap),

    typeBreakdown: Array.from(typeMap.entries()).map(([type, count]) => ({
      type,
      count,
    })),
  });
});

/* -------------------------------------------------------------------------- */
/* Reports                                                                    */
/* -------------------------------------------------------------------------- */

dashboardRoute.get("/reports", async (c) => {
  if (!assertDashboardEnabled()) {
    return c.json(
      {
        error: "Dashboard development mode is disabled.",
      },
      404,
    );
  }

  const projectKey = c.req.query("project");

  if (!projectKey) {
    return c.json(
      {
        error: "Project is required.",
      },
      400,
    );
  }

  const project = await getProject(projectKey);

  if (!project) {
    return c.json(
      {
        error: "Unknown project.",
      },
      404,
    );
  }

  const status = c.req.query("status");

  const search = c.req.query("search");

  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 100);

  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

  const filters = [eq(bugReports.projectId, project.id)];

  if (status && bugStatusSchema.safeParse(status).success) {
    filters.push(
      eq(
        bugReports.status,
        status as "open" | "in_progress" | "resolved" | "closed",
      ),
    );
  }

  if (search?.trim()) {
    const pattern = `%${search.trim()}%`;

    filters.push(
      or(
        ilike(bugReports.description, pattern),
        ilike(bugReports.pageTitle, pattern),
        ilike(bugReports.pageUrl, pattern),
      )!,
    );
  }

  const where = and(...filters);

  const reports = await db
    .select({
      id: bugReports.id,
      description: bugReports.description,
      type: bugReports.type,
      status: bugReports.status,
      severity: bugReports.severity,
      priority: bugReports.priority,
      reproductionSteps: bugReports.reproductionSteps,
      pageUrl: bugReports.pageUrl,
      pageTitle: bugReports.pageTitle,
      viewportWidth: bugReports.viewportWidth,
      viewportHeight: bugReports.viewportHeight,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
      resolvedAt: bugReports.resolvedAt,
    })
    .from(bugReports)
    .where(where)
    .orderBy(desc(bugReports.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({
      count: count(),
    })
    .from(bugReports)
    .where(where);

  return c.json({
    reports,
    total: Number(totalRow?.count ?? 0),
    limit,
    offset,
  });
});

/* -------------------------------------------------------------------------- */
/* Single report                                                              */
/* -------------------------------------------------------------------------- */

dashboardRoute.get("/reports/:reportId", async (c) => {
  if (!assertDashboardEnabled()) {
    return c.json(
      {
        error: "Dashboard development mode is disabled.",
      },
      404,
    );
  }

  const projectKey = c.req.query("project");

  const reportId = c.req.param("reportId");

  if (!projectKey) {
    return c.json(
      {
        error: "Project is required.",
      },
      400,
    );
  }

  const project = await getProject(projectKey);

  if (!project) {
    return c.json(
      {
        error: "Unknown project.",
      },
      404,
    );
  }

  const [report] = await db
    .select({
      id: bugReports.id,
      description: bugReports.description,
      type: bugReports.type,
      status: bugReports.status,
      severity: bugReports.severity,
      priority: bugReports.priority,
      reproductionSteps: bugReports.reproductionSteps,
      pageUrl: bugReports.pageUrl,
      pageTitle: bugReports.pageTitle,
      viewportWidth: bugReports.viewportWidth,
      viewportHeight: bugReports.viewportHeight,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
      resolvedAt: bugReports.resolvedAt,
    })
    .from(bugReports)
    .where(
      and(eq(bugReports.id, reportId), eq(bugReports.projectId, project.id)),
    )
    .limit(1);

  if (!report) {
    return c.json(
      {
        error: "Report not found.",
      },
      404,
    );
  }

  return c.json(report);
});

/* -------------------------------------------------------------------------- */
/* Update report                                                              */
/* -------------------------------------------------------------------------- */

dashboardRoute.patch("/reports/:reportId", async (c) => {
  if (!assertDashboardEnabled()) {
    return c.json(
      {
        error: "Dashboard development mode is disabled.",
      },
      404,
    );
  }

  const body = await c.req.json();

  const parsed = z
    .object({
      project: z.string().min(1),

      status: bugStatusSchema.optional(),

      severity: bugSeveritySchema.optional(),

      priority: bugPrioritySchema.optional(),
    })
    .safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid update.",
      },
      400,
    );
  }

  const project = await getProject(parsed.data.project);

  if (!project) {
    return c.json(
      {
        error: "Unknown project.",
      },
      404,
    );
  }

  const reportId = c.req.param("reportId");

  const update: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.status) {
    update.status = parsed.data.status;

    if (parsed.data.status === "resolved") {
      update.resolvedAt = new Date();
    }

    if (parsed.data.status === "open" || parsed.data.status === "in_progress") {
      update.resolvedAt = null;
    }
  }

  if (parsed.data.severity) {
    update.severity = parsed.data.severity;
  }

  if (parsed.data.priority) {
    update.priority = parsed.data.priority;
  }

  const [report] = await db
    .update(bugReports)
    .set(update)
    .where(
      and(eq(bugReports.id, reportId), eq(bugReports.projectId, project.id)),
    )
    .returning({
      id: bugReports.id,
      description: bugReports.description,
      type: bugReports.type,
      status: bugReports.status,
      severity: bugReports.severity,
      priority: bugReports.priority,
      reproductionSteps: bugReports.reproductionSteps,
      pageUrl: bugReports.pageUrl,
      pageTitle: bugReports.pageTitle,
      viewportWidth: bugReports.viewportWidth,
      viewportHeight: bugReports.viewportHeight,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
      resolvedAt: bugReports.resolvedAt,
    });

  if (!report) {
    return c.json(
      {
        error: "Report not found.",
      },
      404,
    );
  }

  return c.json(report);
});
