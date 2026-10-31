CREATE TABLE "power_points" (
	"plant_id" integer NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"power_w" double precision NOT NULL,
	CONSTRAINT "power_points_plant_id_ts_pk" PRIMARY KEY("plant_id","ts")
);
--> statement-breakpoint
ALTER TABLE "power_points" ADD CONSTRAINT "power_points_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;