import { Hono } from "hono";
import { cors } from "hono/cors";
import { sql } from "drizzle-orm";

import { db } from "./db";
import { bugReportsRoute } from "./routes/bug-reports";
import { dashboardRoute } from "./routes/dashboard";
import { projectsRoute } from "./routes/projects";

const app = new Hono();

// Observability: Request & Response Logging Middleware
app.use("*", async (c, next) => {
  const start = performance.now();
  const method = c.req.method;
  const path = c.req.path;
  const query = c.req.query();
  const queryString =
    Object.keys(query).length > 0
      ? `?${new URLSearchParams(query).toString()}`
      : "";

  console.log(`[API] 📥 ${method} ${path}${queryString ? " " + queryString : ""}`);

  await next();

  const duration = Math.round(performance.now() - start);
  const status = c.res.status;

  if (status >= 500) {
    console.error(
      `[API] 💥 ${status} ${method} ${path}${queryString ? " " + queryString : ""} (${duration}ms)`
    );
  } else if (status >= 400) {
    console.warn(
      `[API] ⚠️  ${status} ${method} ${path}${queryString ? " " + queryString : ""} (${duration}ms)`
    );
  } else {
    console.log(
      `[API] 📤 ${status} ${method} ${path}${queryString ? " " + queryString : ""} (${duration}ms)`
    );
  }
});

// CORS: Allow frontend requests (GET, POST, PATCH, PUT, DELETE, OPTIONS)
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.get("/health", async (c) => {
  try {
    await db.execute(sql`select 1`);

    return c.json({
      ok: true,
      service: "bug-reporter-api",
      database: "connected",
      dashboardDevMode: process.env.DASHBOARD_DEV_MODE === "true",
    });
  } catch (error) {
    console.error("[health] 💥 Database check failed:", error);

    return c.json(
      {
        ok: false,
        service: "bug-reporter-api",
        database: "disconnected",
        error: error instanceof Error ? error.message : String(error),
      },
      503
    );
  }
});

// Mount all routes
app.route("/v1/bug-reports", bugReportsRoute);
app.route("/v1/projects", projectsRoute);
app.route("/v1/dashboard", dashboardRoute);

// Observability: 404 handler with available endpoints
app.notFound((c) => {
  const method = c.req.method;
  const path = c.req.path;
  console.warn(`[API] ⚠️  Route not found: ${method} ${path}`);

  return c.json(
    {
      error: `Route not found: ${method} ${path}`,
      availableEndpoints: [
        "GET /health",
        "POST /v1/bug-reports",
        "GET /v1/projects",
        "POST /v1/projects",
        "PATCH /v1/projects/:projectId",
        "GET /v1/dashboard/overview?project=<key>",
        "GET /v1/dashboard/reports?project=<key>",
        "GET /v1/dashboard/reports/:reportId?project=<key>",
        "PATCH /v1/dashboard/reports/:reportId",
      ],
    },
    404
  );
});

// Observability: Global error handler
app.onError((err, c) => {
  console.error(
    `[API] 💥 Unhandled Exception at ${c.req.method} ${c.req.path}:`,
    err
  );

  return c.json(
    {
      error: err.message || "Internal server error",
      path: c.req.path,
    },
    500
  );
});

const port = Number(process.env.PORT ?? 8787);
console.log(`\n======================================================`);
console.log(`🚀 Bug Reporter API running on http://localhost:${port}`);
console.log(
  `📡 Dashboard Dev Mode: ${
    process.env.DASHBOARD_DEV_MODE === "true"
      ? "ENABLED (Routes active)"
      : "DISABLED"
  }`
);
console.log(`🛣️  Mounted Routes:`);
console.log(`   - GET   /health`);
console.log(`   - POST  /v1/bug-reports`);
console.log(`   - *     /v1/projects`);
console.log(`   - *     /v1/dashboard (overview, reports)`);
console.log(`======================================================\n`);

export default {
  port,
  fetch: app.fetch,
};
