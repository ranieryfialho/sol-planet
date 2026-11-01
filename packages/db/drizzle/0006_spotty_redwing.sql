ALTER TABLE "accounts" DROP CONSTRAINT "accounts_account_unique";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "provider" text DEFAULT 'solplanet' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_idx" ON "accounts" USING btree ("provider","account");