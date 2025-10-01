CREATE TABLE "cohorts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"program" text,
	"campus" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"cohort_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"n_attempted" integer DEFAULT 0 NOT NULL,
	"n_correct" integer,
	"mean_points" numeric(10, 4),
	"max_points" numeric(10, 4),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standard_course_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"standard_node_id" integer NOT NULL,
	"course_node_id" integer NOT NULL,
	"weight_in_standard" numeric(10, 4) DEFAULT '1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "objectives" ADD COLUMN "weight_in_course" numeric(10, 4) DEFAULT '1';--> statement-breakpoint
ALTER TABLE "objectives" ADD COLUMN "proficiency_cut" numeric(10, 4) DEFAULT '0.7';--> statement-breakpoint
ALTER TABLE "objectives" ADD COLUMN "target_rate" numeric(10, 4) DEFAULT '0.8';--> statement-breakpoint
ALTER TABLE "question_results" ADD CONSTRAINT "question_results_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_results" ADD CONSTRAINT "question_results_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_course_weights" ADD CONSTRAINT "standard_course_weights_standard_node_id_nodes_id_fk" FOREIGN KEY ("standard_node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standard_course_weights" ADD CONSTRAINT "standard_course_weights_course_node_id_nodes_id_fk" FOREIGN KEY ("course_node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cohorts_name_idx" ON "cohorts" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "question_results_cohort_q_uk" ON "question_results" USING btree ("cohort_id","question_id");--> statement-breakpoint
CREATE INDEX "question_results_cohort_idx" ON "question_results" USING btree ("cohort_id");--> statement-breakpoint
CREATE INDEX "question_results_q_idx" ON "question_results" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "standard_course_weights_uk" ON "standard_course_weights" USING btree ("standard_node_id","course_node_id");--> statement-breakpoint
CREATE INDEX "standard_course_weights_std_idx" ON "standard_course_weights" USING btree ("standard_node_id");--> statement-breakpoint
CREATE INDEX "standard_course_weights_course_idx" ON "standard_course_weights" USING btree ("course_node_id");