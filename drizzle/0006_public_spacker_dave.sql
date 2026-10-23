CREATE TABLE "friendships" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" bigint NOT NULL,
	"addressee_id" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "friendships_not_self" CHECK ("friendships"."requester_id" <> "friendships"."addressee_id")
);
--> statement-breakpoint
ALTER TABLE "privacy_settings" ADD COLUMN "accept_friend_requests" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_pair_idx" ON "friendships" USING btree (least("requester_id", "addressee_id"),greatest("requester_id", "addressee_id"));--> statement-breakpoint
CREATE INDEX "friendships_addressee_idx" ON "friendships" USING btree ("addressee_id","status");--> statement-breakpoint
CREATE INDEX "friendships_requester_created_idx" ON "friendships" USING btree ("requester_id","created_at");