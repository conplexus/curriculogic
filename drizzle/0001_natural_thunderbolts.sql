CREATE TABLE "assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"term" text,
	"year" integer,
	"date_administered" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"course_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objective_standard_item_map" (
	"objective_id" integer NOT NULL,
	"standard_item_id" integer NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	CONSTRAINT "objective_standard_item_map_objective_id_standard_item_id_pk" PRIMARY KEY("objective_id","standard_item_id")
);
--> statement-breakpoint
CREATE TABLE "question_objective_map" (
	"question_id" integer NOT NULL,
	"objective_id" integer NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	CONSTRAINT "question_objective_map_question_id_objective_id_pk" PRIMARY KEY("question_id","objective_id")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"label" text NOT NULL,
	"max_points" real NOT NULL,
	"type" text,
	"active_bool" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "standard_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"standard_id" integer NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"parent_id" integer
);
--> statement-breakpoint
CREATE TABLE "student_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"assessment_id" integer NOT NULL,
	"attempt_no" integer DEFAULT 1,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "student_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"attempt_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"raw_score" real NOT NULL,
	"max_points" real NOT NULL,
	"correct_bool" boolean
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_key" text,
	"cohort" text,
	"program" text,
	"active_bool" boolean DEFAULT true
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_standard_item_map" ADD CONSTRAINT "objective_standard_item_map_objective_id_course_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."course_objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_standard_item_map" ADD CONSTRAINT "objective_standard_item_map_standard_item_id_standard_items_id_fk" FOREIGN KEY ("standard_item_id") REFERENCES "public"."standard_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_objective_map" ADD CONSTRAINT "question_objective_map_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_objective_map" ADD CONSTRAINT "question_objective_map_objective_id_course_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."course_objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_items" ADD CONSTRAINT "standard_items_standard_id_standards_id_fk" FOREIGN KEY ("standard_id") REFERENCES "public"."standards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_items" ADD CONSTRAINT "standard_items_parent_id_standard_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."standard_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_attempts" ADD CONSTRAINT "student_attempts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_attempts" ADD CONSTRAINT "student_attempts_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_responses" ADD CONSTRAINT "student_responses_attempt_id_student_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."student_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_responses" ADD CONSTRAINT "student_responses_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;