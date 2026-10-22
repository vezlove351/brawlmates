CREATE TABLE "users" (
	"id" bigint PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
