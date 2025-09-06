CREATE TABLE "course_objectives" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"code" text,
	"text" text NOT NULL,
	"version" text DEFAULT 'v1',
	"active_bool" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"term" text,
	"year" integer,
	"credits" real
);
--> statement-breakpoint
CREATE TABLE "standards" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"authority" text NOT NULL,
	"version" text NOT NULL,
	"effective_from" text NOT NULL,
	"effective_to" text
);
--> statement-breakpoint
ALTER TABLE "course_objectives" ADD CONSTRAINT "course_objectives_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;