CREATE TABLE "api_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tip_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"tip_id" integer NOT NULL,
	"reporter_id" bigint NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolution" text,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tip_votes" (
	"tip_id" integer NOT NULL,
	"user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tip_votes_tip_id_user_id_pk" PRIMARY KEY("tip_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tips" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" bigint NOT NULL,
	"brawler_id" integer NOT NULL,
	"mode" text,
	"map" text,
	"gadget_id" integer,
	"star_power_id" integer,
	"gear_id" integer,
	"text" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"useful_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tip_reports" ADD CONSTRAINT "tip_reports_tip_id_tips_id_fk" FOREIGN KEY ("tip_id") REFERENCES "public"."tips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_reports" ADD CONSTRAINT "tip_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_votes" ADD CONSTRAINT "tip_votes_tip_id_tips_id_fk" FOREIGN KEY ("tip_id") REFERENCES "public"."tips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_votes" ADD CONSTRAINT "tip_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tip_reports_once_idx" ON "tip_reports" USING btree ("tip_id","reporter_id");--> statement-breakpoint
CREATE INDEX "tips_feed_idx" ON "tips" USING btree ("status","brawler_id");--> statement-breakpoint
CREATE INDEX "tips_author_idx" ON "tips" USING btree ("author_id","created_at");