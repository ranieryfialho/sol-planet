CREATE TABLE "alerts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"plant_id" integer,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"error_code" text,
	"device_sn" text,
	"fingerprint" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "alerts_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "daily_energy" (
	"plant_id" integer NOT NULL,
	"day" date NOT NULL,
	"energy_kwh" double precision NOT NULL,
	"peak_w" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_energy_plant_id_day_pk" PRIMARY KEY("plant_id","day")
);
--> statement-breakpoint
CREATE TABLE "kv" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plants" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"capacity_kwp" double precision,
	"status" integer NOT NULL,
	"power_w" double precision DEFAULT 0 NOT NULL,
	"today_kwh" double precision DEFAULT 0 NOT NULL,
	"total_kwh" double precision DEFAULT 0 NOT NULL,
	"bad_since" timestamp with time zone,
	"alerted_at" timestamp with time zone,
	"raw" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"plant_id" integer NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"status" integer NOT NULL,
	"power_w" double precision NOT NULL,
	"today_kwh" double precision NOT NULL,
	"total_kwh" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_energy" ADD CONSTRAINT "daily_energy_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_occurred_idx" ON "alerts" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "readings_plant_ts_idx" ON "readings" USING btree ("plant_id","ts");