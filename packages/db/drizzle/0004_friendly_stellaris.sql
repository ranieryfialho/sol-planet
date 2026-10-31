CREATE TABLE "account_plants" (
	"account_id" integer NOT NULL,
	"plant_id" integer NOT NULL,
	CONSTRAINT "account_plants_account_id_plant_id_pk" PRIMARY KEY("account_id","plant_id")
);
--> statement-breakpoint
ALTER TABLE "account_plants" ADD CONSTRAINT "account_plants_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_plants" ADD CONSTRAINT "account_plants_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "account_plants" ("account_id", "plant_id") SELECT "account_id", "id" FROM "plants" WHERE "account_id" IS NOT NULL ON CONFLICT DO NOTHING;
