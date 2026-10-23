CREATE TABLE "hidden_users" (
	"user_id" bigint NOT NULL,
	"hidden_user_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hidden_users_user_id_hidden_user_id_pk" PRIMARY KEY("user_id","hidden_user_id")
);
--> statement-breakpoint
CREATE TABLE "lfg_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" bigint NOT NULL,
	"player_tag" text NOT NULL,
	"player_name" text NOT NULL,
	"author_trophies" integer NOT NULL,
	"mode" text NOT NULL,
	"brawler_ids" integer[] NOT NULL,
	"trophies_min" integer NOT NULL,
	"trophies_max" integer NOT NULL,
	"language" text NOT NULL,
	"players_needed" integer NOT NULL,
	"comment" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lfg_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"reporter_id" bigint NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolution" text,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lfg_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"responder_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_settings" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"show_telegram_contact" boolean DEFAULT false NOT NULL,
	"telegram_username" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hidden_users" ADD CONSTRAINT "hidden_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hidden_users" ADD CONSTRAINT "hidden_users_hidden_user_id_users_id_fk" FOREIGN KEY ("hidden_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lfg_posts" ADD CONSTRAINT "lfg_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lfg_reports" ADD CONSTRAINT "lfg_reports_post_id_lfg_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."lfg_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lfg_reports" ADD CONSTRAINT "lfg_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lfg_responses" ADD CONSTRAINT "lfg_responses_post_id_lfg_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."lfg_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lfg_responses" ADD CONSTRAINT "lfg_responses_responder_id_users_id_fk" FOREIGN KEY ("responder_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_settings" ADD CONSTRAINT "privacy_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lfg_posts_one_active_idx" ON "lfg_posts" USING btree ("author_id") WHERE "lfg_posts"."status" = 'active';--> statement-breakpoint
CREATE INDEX "lfg_posts_feed_idx" ON "lfg_posts" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "lfg_posts_author_created_idx" ON "lfg_posts" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lfg_reports_once_idx" ON "lfg_reports" USING btree ("post_id","reporter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lfg_responses_once_idx" ON "lfg_responses" USING btree ("post_id","responder_id");--> statement-breakpoint
CREATE INDEX "lfg_responses_responder_created_idx" ON "lfg_responses" USING btree ("responder_id","created_at");