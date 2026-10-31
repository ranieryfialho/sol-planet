CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account" text NOT NULL,
	"password_enc" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_account_unique" UNIQUE("account")
);
--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "account_id" integer;--> statement-breakpoint
ALTER TABLE "plants" ADD CONSTRAINT "plants_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;