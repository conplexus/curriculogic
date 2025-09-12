// src/db/schema.ts
import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  numeric,
  jsonb,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* =========================
   Core org & user models
   ========================= */

export const organizations = pgTable(
  "organizations",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex("org_slug_uk").on(t.slug),
  })
);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    authUserId: text("auth_user_id").notNull().unique(), // NextAuth/Clerk/etc
    name: text("name"),
    email: text("email").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    emailUk: uniqueIndex("user_email_uk").on(t.email),
    authUserUk: uniqueIndex("user_auth_user_id_uk").on(t.authUserId),
  })
);

export const orgMembers = pgTable(
  "org_members",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").references(() => organizations.id).notNull(),
    userId: integer("user_id").references(() => users.id).notNull(),
    role: text("role")
      .$type<"OWNER" | "ADMIN" | "EDITOR" | "VIEWER">()
      .default("VIEWER")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgUserUk: uniqueIndex("org_members_org_user_uk").on(t.orgId, t.userId),
    orgIdx: index("org_members_org_idx").on(t.orgId),
    userIdx: index("org_members_user_idx").on(t.userId),
  })
);

/* =========================
   Curriculum maps & graph
   ========================= */

export const maps = pgTable(
  "maps",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").references(() => organizations.id).notNull(),
    name: text("name").notNull(),
    frameworkTag: text("framework_tag").default("CUSTOM"),
    isArchived: boolean("is_archived").default(false),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(), // update in app or via trigger
  },
  (t) => ({
    orgIdx: index("maps_org_idx").on(t.orgId),
    frameworkIdx: index("maps_framework_idx").on(t.frameworkTag),
  })
);

// Graph nodes: standards, courses, objectives, assessments, questions
export type NodeKind = "STANDARD" | "COURSE" | "OBJECTIVE" | "ASSESSMENT" | "ITEM";

export const nodes = pgTable(
  "nodes",
  {
    id: serial("id").primaryKey(),
    mapId: integer("map_id").references(() => maps.id).notNull(),
    kind: text("kind").$type<NodeKind>().notNull(),
    code: text("code"), // e.g., "Std 1.2", "PHRX-501"
    title: text("title").notNull(),
    description: text("description"),
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    // Layout (persist positions)
    x: numeric("x", { precision: 10, scale: 2 }).default("0"),
    y: numeric("y", { precision: 10, scale: 2 }).default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(), // update in app or via trigger
  },
  (t) => ({
    mapIdx: index("nodes_map_idx").on(t.mapId),
    kindIdx: index("nodes_kind_idx").on(t.kind),
    mapCodeIdx: index("nodes_map_code_idx").on(t.mapId, t.code),
  })
);

// Directed edges (parent -> child)
export const edges = pgTable(
  "edges",
  {
    id: serial("id").primaryKey(),
    mapId: integer("map_id").references(() => maps.id).notNull(),
    sourceId: integer("source_id").references(() => nodes.id).notNull(),
    targetId: integer("target_id").references(() => nodes.id).notNull(),
    label: text("label"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    mapSrcTgtUk: uniqueIndex("edges_map_src_tgt_uk").on(t.mapId, t.sourceId, t.targetId),
    mapIdx: index("edges_map_idx").on(t.mapId),
    srcIdx: index("edges_source_idx").on(t.sourceId),
    tgtIdx: index("edges_target_idx").on(t.targetId),
  })
);

// Aggregated performance (FERPA-safe)
export const aggMetrics = pgTable(
  "agg_metrics",
  {
    id: serial("id").primaryKey(),
    nodeId: integer("node_id").references(() => nodes.id).notNull(),
    // aggregates only
    nAttempts: integer("n_attempts").default(0).notNull(),
    mean: numeric("mean", { precision: 5, scale: 2 }),
    median: numeric("median", { precision: 5, scale: 2 }),
    p25: numeric("p25", { precision: 5, scale: 2 }),
    p75: numeric("p75", { precision: 5, scale: 2 }),
    stdev: numeric("stdev", { precision: 6, scale: 3 }),
    // optional histogram bins
    bins: jsonb("bins").$type<Record<string, number>>(),
    timeframe: text("timeframe").default("ALL"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    nodeTimeUk: uniqueIndex("agg_metrics_node_timeframe_uk").on(t.nodeId, t.timeframe),
    nodeIdx: index("agg_metrics_node_idx").on(t.nodeId),
  })
);

// Lightweight audit log
export const audits = pgTable(
  "audits",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => users.id),
    orgId: integer("org_id").references(() => organizations.id),
    mapId: integer("map_id").references(() => maps.id),
    action: text("action"), // NODE_CREATE, NODE_UPDATE, EDGE_CREATE, etc.
    details: jsonb("details"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("audits_org_idx").on(t.orgId),
    mapIdx: index("audits_map_idx").on(t.mapId),
    actorIdx: index("audits_actor_idx").on(t.actorId),
    actionIdx: index("audits_action_idx").on(t.action),
  })
);

/* =========================
   Academic model: courses, objectives, assessments
   ========================= */

// Basic course table (matches your UI usage)
export const courses = pgTable(
  "courses",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").references(() => organizations.id), // optional for now
    code: varchar("code", { length: 64 }).notNull(),
    title: text("title").notNull(),
    term: varchar("term", { length: 32 }), // e.g., "Fall", "Spring"
    year: integer("year"),
    credits: integer("credits"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    codeIdx: index("courses_code_idx").on(t.code),
    orgCodeIdx: index("courses_org_code_idx").on(t.orgId, t.code),
  })
);

// Course-level objectives/outcomes
export const objectives = pgTable(
  "objectives",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }), // e.g., "OBJ-1.2"
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    courseIdx: index("objectives_course_idx").on(t.courseId),
    courseCodeIdx: index("objectives_course_code_idx").on(t.courseId, t.code),
  })
);

export const assessments = pgTable(
  "assessments",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 256 }).notNull(),
    kind: varchar("kind", { length: 32 }).notNull(), // "Exam","Quiz","OSCE", etc.
    administeredAt: timestamp("administered_at", { withTimezone: false }),
    isArchived: boolean("is_archived").default(false).notNull(),
  },
  (t) => ({
    courseIdx: index("assessments_course_idx").on(t.courseId),
    kindIdx: index("assessments_kind_idx").on(t.kind),
    whenIdx: index("assessments_administered_at_idx").on(t.administeredAt),
  })
);

// Optional: friendly label to match CSV “Q1, Q2...” plus stable shortId if desired
export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    assessmentId: integer("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 64 }).notNull(), // e.g., "Q1"
    text: varchar("text", { length: 2000 }), // optional stem
    points: numeric("points", { precision: 10, scale: 2 }).default("1"),
  },
  (t) => ({
    assessIdx: index("questions_assessment_idx").on(t.assessmentId),
    assessLabelUk: uniqueIndex("questions_assessment_label_uk").on(t.assessmentId, t.label),
  })
);

// Map Q ↔ objective (weights let you split a question across multiple objectives)
export const questionObjectives = pgTable(
  "question_objectives",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    objectiveId: integer("objective_id")
      .notNull()
      .references(() => objectives.id, { onDelete: "cascade" }),
    weight: numeric("weight", { precision: 6, scale: 3 }).default("1"), // fraction of the question mapped to this objective
  },
  (t) => ({
    qIdx: index("question_objectives_q_idx").on(t.questionId),
    objIdx: index("question_objectives_obj_idx").on(t.objectiveId),
  })
);

// Aggregate-only stats captured on import
export const questionStats = pgTable(
  "question_stats",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" })
      .unique(), // one row per question (per latest import)
    nGraded: integer("n_graded").notNull(),
    nCorrect: integer("n_correct").notNull(),
    nIncorrect: integer("n_incorrect").notNull(),
    nBlank: integer("n_blank").notNull(),
    meanScore: numeric("mean_score", { precision: 10, scale: 4 }),
    pValue: numeric("p_value", { precision: 6, scale: 4 }), // difficulty = proportion correct
  },
  (t) => ({
    qIdx: index("question_stats_q_idx").on(t.questionId),
  })
);

export const assessmentStats = pgTable(
  "assessment_stats",
  {
    id: serial("id").primaryKey(),
    assessmentId: integer("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" })
      .unique(),
    nGraded: integer("n_graded").notNull(),
    meanScore: numeric("mean_score", { precision: 10, scale: 4 }),
  },
  (t) => ({
    assessIdx: index("assessment_stats_assess_idx").on(t.assessmentId),
  })
);

export const objectiveStats = pgTable(
  "objective_stats",
  {
    id: serial("id").primaryKey(),
    objectiveId: integer("objective_id")
      .notNull()
      .references(() => objectives.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    assessmentId: integer("assessment_id").references(() => assessments.id, { onDelete: "cascade" }), // nullable = course rollup
    nGraded: integer("n_graded").notNull(),
    achievedCount: integer("achieved_count").notNull(),
    pctAchieved: numeric("pct_achieved", { precision: 6, scale: 3 }).notNull(),
  },
  (t) => ({
    objIdx: index("objective_stats_objective_idx").on(t.objectiveId),
    courseIdx: index("objective_stats_course_idx").on(t.courseId),
    assessIdx: index("objective_stats_assessment_idx").on(t.assessmentId),
  })
);
