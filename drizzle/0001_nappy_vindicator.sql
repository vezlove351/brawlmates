CREATE TABLE "tag_link_requests" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"player_tag" text NOT NULL,
	"icon_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "player_tag" text;--> statement-breakpoint
ALTER TABLE "tag_link_requests" ADD CONSTRAINT "tag_link_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_player_tag_unique" UNIQUE("player_tag");