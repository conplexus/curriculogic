import { time } from "console";
import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  primaryKey,
  boolean,
} from "drizzle-orm/pg-core";
import { title } from "process";

// Standards
export const standards = pgTable("standards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  authority: text("authority").notNull(),
  version: text("version").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
});

// Standard Items
export const standardItems = pgTable("standard_items", {
  id: serial("id").primaryKey(),
  standardId: integer("standard_id")
    .notNull()
    .references(() => standards.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  parentId: integer("parent_id").references(() => standardItems.id, {
    onDelete: "set null",
  }),
});

// Courses
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  term: text("term"),
  year: integer("year"),
  credits: real("credits"),
});

// Course Objectives
export const courseObjectives = pgTable("course_objectives", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id),
  code: text("code"),
  text: text("text").notNull(),
  version: text("version").default("v1"),
  activeBool: boolean("active_bool").default(true),
});

// Assessments
export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type"),
  term: text("term"),
  year: integer("year"),
  dateAdministered: timestamp("date_administered", { withTimezone: true }),
});

// Questions
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  maxPoints: real("max_points").notNull(),
  type: text("type"),
  activeBool: boolean("active_bool").default(true),
});

// Students
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  externalKey: text("external_key"),
  cohort: text("cohort"),
  program: text("program"),
  activeBool: boolean("active_bool").default(true),
});

// Enrollments
export const enrollments = pgTable("enrollments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
});

// Student Attempts
export const studentAttempts = pgTable("student_attempts", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  attemptNo: integer("attempt_no").default(1),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
});

// Student Responses
export const studentResponses = pgTable("student_responses", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id")
    .notNull()
    .references(() => studentAttempts.id, { onDelete: "cascade" }),
  questionId: integer("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  rawScore: real("raw_score").notNull(),
  maxPoints: real("max_points").notNull(),
  correctBool: boolean("correct_bool"),
});

// Map: Question <> Objective (weighted)
export const questionObjectiveMap = pgTable(
  "question_objective_map",
  {
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    objectiveId: integer("objective_id")
      .notNull()
      .references(() => courseObjectives.id, { onDelete: "cascade" }),
    weight: real("weight").notNull().default(1.0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.questionId, t.objectiveId] }),
  })
);

// Map: Objective <> Standard Item (weighted)
export const objectiveStandardItemMap = pgTable(
  "objective_standard_item_map",
  {
    objectiveId: integer("objective_id")
      .notNull()
      .references(() => courseObjectives.id, { onDelete: "cascade" }),
    standardItemId: integer("standard_item_id")
      .notNull()
      .references(() => standardItems.id, { onDelete: "cascade" }),
    weight: real("weight").notNull().default(1.0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.objectiveId, t.standardItemId] }),
  })
);
