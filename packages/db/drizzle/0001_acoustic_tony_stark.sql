CREATE TABLE "inverters" (
	"sn" text PRIMARY KEY NOT NULL,
	"plant_id" integer NOT NULL,
	"name" text,
	"model" text,
	"status" integer,
	"power_w" double precision,
	"pv" jsonb,
	"ac" jsonb,
	"raw" jsonb,
	"params" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "month_kwh" double precision;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "co2_kg" double precision;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "flow" jsonb;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "has_meter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "has_battery" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plants" ADD COLUMN "detail" jsonb;--> statement-breakpoint
ALTER TABLE "readings" ADD COLUMN "load_w" double precision;--> statement-breakpoint
ALTER TABLE "readings" ADD COLUMN "grid_w" double precision;--> statement-breakpoint
ALTER TABLE "readings" ADD COLUMN "battery_w" double precision;--> statement-breakpoint
ALTER TABLE "readings" ADD COLUMN "soc" double precision;--> statement-breakpoint
ALTER TABLE "inverters" ADD CONSTRAINT "inverters_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;