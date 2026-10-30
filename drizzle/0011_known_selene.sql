CREATE TABLE "tournament_participants" (
	"tournament_id" integer NOT NULL,
	"user_id" bigint NOT NULL,
	"player_tag" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_participants_tournament_id_user_id_pk" PRIMARY KEY("tournament_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tournament_results" (
	"round_id" integer NOT NULL,
	"user_id" bigint NOT NULL,
	"place" integer,
	"points" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'auto' NOT NULL,
	CONSTRAINT "tournament_results_round_id_user_id_pk" PRIMARY KEY("round_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tournament_rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"tournament_id" integer NOT NULL,
	"number" integer NOT NULL,
	"room_link" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"battle_time" timestamp with time zone,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"format" text DEFAULT 'showdown' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"map" text,
	"max_players" integer DEFAULT 10 NOT NULL,
	"condition" text DEFAULT 'all' NOT NULL,
	"min_trophies" integer,
	"rounds" integer NOT NULL,
	"points_by_place" integer[] NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "tournaments_rounds_positive" CHECK ("tournaments"."rounds" between 1 and 10),
	CONSTRAINT "tournaments_max_players" CHECK ("tournaments"."max_players" between 2 and 10)
);
--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_results" ADD CONSTRAINT "tournament_results_round_id_tournament_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."tournament_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_results" ADD CONSTRAINT "tournament_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_participants_tag_idx" ON "tournament_participants" USING btree ("tournament_id","player_tag");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_rounds_number_idx" ON "tournament_rounds" USING btree ("tournament_id","number");--> statement-breakpoint
CREATE INDEX "tournaments_status_starts_idx" ON "tournaments" USING btree ("status","starts_at");