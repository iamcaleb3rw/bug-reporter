import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db";
import { projects } from "../db/schema";

function enabled() {
  return process.env.DASHBOARD_DEV_MODE === "true";
}

export const projectsRoute = new Hono();

projectsRoute.get("/", async (c) => {
  if (!enabled()) {
    return c.json(
      {
        error: "Dashboard development mode is disabled.",
      },
      404,
    );
  }

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      publicKey: projects.publicKey,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .orderBy(asc(projects.name));

  return c.json(rows);
});

projectsRoute.post("/", async (c) => {
  if (!enabled()) {
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
      name: z.string().trim().min(1).max(255),
    })
    .safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: "Project name is required.",
      },
      400,
    );
  }

  const publicKey = `pub_${crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 20)}`;

  const [project] = await db
    .insert(projects)
    .values({
      name: parsed.data.name,
      publicKey,
    })
    .returning({
      id: projects.id,
      name: projects.name,
      publicKey: projects.publicKey,
      createdAt: projects.createdAt,
    });

  return c.json(project, 201);
});

projectsRoute.patch("/:projectId", async (c) => {
  if (!enabled()) {
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
      name: z.string().trim().min(1).max(255),
    })
    .safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: "Project name is required.",
      },
      400,
    );
  }

  const [project] = await db
    .update(projects)
    .set({
      name: parsed.data.name,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, c.req.param("projectId")))
    .returning({
      id: projects.id,
      name: projects.name,
      publicKey: projects.publicKey,
      createdAt: projects.createdAt,
    });

  if (!project) {
    return c.json(
      {
        error: "Project not found.",
      },
      404,
    );
  }

  return c.json(project);
});
