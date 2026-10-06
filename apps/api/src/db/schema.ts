import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const bugTypeEnum = pgEnum("bug_type", [
  "functional",
  "visual",
  "performance",
  "content",
  "accessibility",
  "other",
]);

export const bugStatusEnum = pgEnum("bug_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const bugSeverityEnum = pgEnum("bug_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const bugPriorityEnum = pgEnum("bug_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

/* -------------------------------------------------------------------------- */
/* Projects                                                                   */
/* -------------------------------------------------------------------------- */

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /**
     * Clerk user ID of the owner (e.g. "user_2abc...").
     * Every project belongs to exactly one user.
     */
    ownerId: varchar("owner_id", { length: 255 }).notNull(),

    /**
     * Public identifier used by the widget:
     *   <script data-project="pub_test">
     */
    publicKey: varchar("public_key", {
      length: 100,
    })
      .notNull()
      .unique(),

    name: varchar("name", {
      length: 255,
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("projects_owner_idx").on(table.ownerId)],
);

/* -------------------------------------------------------------------------- */
/* Bug Reports                                                                */
/* -------------------------------------------------------------------------- */

export const bugReports = pgTable(
  "bug_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
      }),

    description: text("description").notNull(),

    type: bugTypeEnum("type").notNull(),

    reproductionSteps: text("reproduction_steps"),

    pageUrl: text("page_url").notNull(),

    pageTitle: text("page_title").notNull(),

    viewportWidth: integer("viewport_width").notNull(),

    viewportHeight: integer("viewport_height").notNull(),

    status: bugStatusEnum("status").notNull().default("open"),

    severity: bugSeverityEnum("severity").notNull().default("medium"),

    priority: bugPriorityEnum("priority").notNull().default("medium"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    resolvedAt: timestamp("resolved_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    index("bug_reports_project_idx").on(table.projectId),
    index("bug_reports_status_idx").on(table.status),
    index("bug_reports_created_at_idx").on(table.createdAt),
  ],
);

export const projectsRelations = relations(projects, ({ many }) => ({
  bugReports: many(bugReports),
}));

export const bugReportsRelations = relations(bugReports, ({ one }) => ({
  project: one(projects, {
    fields: [bugReports.projectId],
    references: [projects.id],
  }),
}));
