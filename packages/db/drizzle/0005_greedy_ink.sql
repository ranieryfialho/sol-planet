ALTER TABLE "alerts" ADD COLUMN "account_id" integer;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
UPDATE "alerts" a SET "account_id" = p."account_id" FROM "plants" p WHERE a."plant_id" = p."id" AND a."account_id" IS NULL;
