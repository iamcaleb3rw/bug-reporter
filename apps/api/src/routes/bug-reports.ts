import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { bugReports, projects } from "../db/schema";

const createBugReportSchema = z.object({
  project: z.string().trim().min(1).max(100),

  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(10_000, "Description is too long."),

  type: z.enum([
    "functional",
    "visual",
    "performance",
    "content",
    "accessibility",
    "other",
  ]),

  reproductionSteps: z
    .string()
    .trim()
    .max(10_000, "Reproduction steps are too long.")
    .optional(),

  context: z.object({
    url: z.string().url().max(4_000),

    title: z.string().max(500),

    viewport: z.object({
      width: z.number().int().nonnegative(),

      height: z.number().int().nonnegative(),
    }),
  }),
});

export const bugReportsRoute = new Hono();

bugReportsRoute.post(
  "/",
  zValidator("json", createBugReportSchema),
  async (c) => {
    const payload = c.req.valid("json");

    const [project] = await db
      .select({
        id: projects.id,
      })
      .from(projects)
      .where(eq(projects.publicKey, payload.project))
      .limit(1);

    if (!project) {
      return c.json(
        {
          error: "Unknown project.",
        },
        404,
      );
    }

    const [bugReport] = await db
      .insert(bugReports)
      .values({
        projectId: project.id,

        description: payload.description,

        type: payload.type,

        reproductionSteps: payload.reproductionSteps || null,

        pageUrl: payload.context.url,

        pageTitle: payload.context.title,

        viewportWidth: payload.context.viewport.width,

        viewportHeight: payload.context.viewport.height,
      })
      .returning({
        id: bugReports.id,
        status: bugReports.status,
        createdAt: bugReports.createdAt,
      });

    if (!bugReport) {
      return c.json(
        {
          error: "Failed to create bug report.",
        },
        500,
      );
    }

    return c.json(
      {
        id: bugReport.id,
        status: bugReport.status,
        createdAt: bugReport.createdAt,
      },
      201,
    );
  },
);
