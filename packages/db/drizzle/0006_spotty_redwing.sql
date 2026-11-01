ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_account_unique";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'solplanet' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_account_idx" ON "accounts" USING btree ("provider","account");
