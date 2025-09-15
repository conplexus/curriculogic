CREATE TABLE "agg_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_id" integer NOT NULL,
	"n_attempts" integer DEFAULT 0 NOT NULL,
	"mean" numeric(5, 2),
	"median" numeric(5, 2),
	"p25" numeric(5, 2),
	"p75" numeric(5, 2),
	"stdev" numeric(6, 3),
	"bins" jsonb,
	"timeframe" text DEFAULT 'ALL',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"n_graded" integer NOT NULL,
	"mean_score" numeric(10, 4),
	CONSTRAINT "assessment_stats_assessment_id_unique" UNIQUE("assessment_id")
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"title" varchar(256) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"administered_at" timestamp,
	"is_archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"org_id" integer,
	"map_id" integer,
	"action" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer,
	"code" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"term" varchar(32),
	"year" integer,
	"credits" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"label" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maps" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"name" text NOT NULL,
	"framework_tag" text DEFAULT 'CUSTOM',
	"is_archived" boolean DEFAULT false,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"map_id" integer NOT NULL,
	"kind" text NOT NULL,
	"code" text,
	"title" text NOT NULL,
	"description" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"x" numeric(10, 2) DEFAULT '0',
	"y" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objective_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"objective_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"assessment_id" integer,
	"n_graded" integer NOT NULL,
	"achieved_count" integer NOT NULL,
	"pct_achieved" numeric(6, 3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"code" varchar(64),
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'VIEWER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "question_objectives" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"objective_id" integer NOT NULL,
	"weight" numeric(6, 3) DEFAULT '1'
);
--> statement-breakpoint
CREATE TABLE "question_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"n_graded" integer NOT NULL,
	"n_correct" integer NOT NULL,
	"n_incorrect" integer NOT NULL,
	"n_blank" integer NOT NULL,
	"mean_score" numeric(10, 4),
	"p_value" numeric(6, 4),
	CONSTRAINT "question_stats_question_id_unique" UNIQUE("question_id")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"label" varchar(64) NOT NULL,
	"text" varchar(2000),
	"points" numeric(10, 2) DEFAULT '1'
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"auth_user_id" text NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agg_metrics" ADD CONSTRAINT "agg_metrics_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_stats" ADD CONSTRAINT "assessment_stats_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_source_id_nodes_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_target_id_nodes_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maps" ADD CONSTRAINT "maps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_stats" ADD CONSTRAINT "objective_stats_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_stats" ADD CONSTRAINT "objective_stats_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_stats" ADD CONSTRAINT "objective_stats_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_objectives" ADD CONSTRAINT "question_objectives_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_objectives" ADD CONSTRAINT "question_objectives_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_stats" ADD CONSTRAINT "question_stats_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agg_metrics_node_timeframe_uk" ON "agg_metrics" USING btree ("node_id","timeframe");--> statement-breakpoint
CREATE INDEX "agg_metrics_node_idx" ON "agg_metrics" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "assessment_stats_assess_idx" ON "assessment_stats" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "assessments_course_idx" ON "assessments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "assessments_kind_idx" ON "assessments" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "assessments_administered_at_idx" ON "assessments" USING btree ("administered_at");--> statement-breakpoint
CREATE INDEX "audits_org_idx" ON "audits" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "audits_map_idx" ON "audits" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "audits_actor_idx" ON "audits" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audits_action_idx" ON "audits" USING btree ("action");--> statement-breakpoint
CREATE INDEX "courses_code_idx" ON "courses" USING btree ("code");--> statement-breakpoint
CREATE INDEX "courses_org_code_idx" ON "courses" USING btree ("org_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "edges_map_src_tgt_uk" ON "edges" USING btree ("map_id","source_id","target_id");--> statement-breakpoint
CREATE INDEX "edges_map_idx" ON "edges" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "edges_source_idx" ON "edges" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "edges_target_idx" ON "edges" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "maps_org_idx" ON "maps" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "maps_framework_idx" ON "maps" USING btree ("framework_tag");--> statement-breakpoint
CREATE INDEX "nodes_map_idx" ON "nodes" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "nodes_kind_idx" ON "nodes" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "nodes_map_code_idx" ON "nodes" USING btree ("map_id","code");--> statement-breakpoint
CREATE INDEX "objective_stats_objective_idx" ON "objective_stats" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX "objective_stats_course_idx" ON "objective_stats" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "objective_stats_assessment_idx" ON "objective_stats" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "objectives_course_idx" ON "objectives" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "objectives_course_code_idx" ON "objectives" USING btree ("course_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_org_user_uk" ON "org_members" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "org_members_org_idx" ON "org_members" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_members_user_idx" ON "org_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_slug_uk" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "question_objectives_q_idx" ON "question_objectives" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "question_objectives_obj_idx" ON "question_objectives" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX "question_stats_q_idx" ON "question_stats" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "questions_assessment_idx" ON "questions" USING btree ("assessment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_assessment_label_uk" ON "questions" USING btree ("assessment_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_uk" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "user_auth_user_id_uk" ON "users" USING btree ("auth_user_id");