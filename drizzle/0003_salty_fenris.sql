CREATE TABLE "battles" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_tag" text NOT NULL,
	"battle_time" timestamp with time zone NOT NULL,
	"mode" text NOT NULL,
	"map" text,
	"type" text,
	"result" text,
	"rank" integer,
	"trophy_change" integer,
	"brawler_id" integer
);
--> statement-breakpoint
CREATE TABLE "trophy_history" (
	"player_tag" text NOT NULL,
	"day" date NOT NULL,
	"trophies" integer NOT NULL,
	CONSTRAINT "trophy_history_player_tag_day_pk" PRIMARY KEY("player_tag","day")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "battles_player_time_idx" ON "battles" USING btree ("player_tag","battle_time");