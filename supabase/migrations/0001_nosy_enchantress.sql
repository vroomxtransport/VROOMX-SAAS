CREATE TYPE "public"."business_expense_category" AS ENUM('insurance', 'tolls_fixed', 'dispatch', 'parking', 'rent', 'telematics', 'registration', 'salary', 'truck_lease', 'office_supplies', 'software', 'professional_services', 'other');--> statement-breakpoint
CREATE TYPE "public"."business_expense_recurrence" AS ENUM('monthly', 'quarterly', 'annual', 'one_time');--> statement-breakpoint
ALTER TYPE "public"."driver_type" ADD VALUE 'local_driver';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'factored';--> statement-breakpoint
CREATE TABLE "business_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "business_expense_category" NOT NULL,
	"recurrence" "business_expense_recurrence" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"truck_id" uuid,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "local_fee" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "driver_pay_rate_override" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pickup_latitude" double precision;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pickup_longitude" double precision;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_latitude" double precision;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_longitude" double precision;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "factoring_fee_rate" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "total_local_fees" numeric(12, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "route_sequence" jsonb;--> statement-breakpoint
ALTER TABLE "business_expenses" ADD CONSTRAINT "business_expenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_expenses" ADD CONSTRAINT "business_expenses_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_notifications" ADD CONSTRAINT "web_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_business_expenses_tenant_id" ON "business_expenses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_business_expenses_tenant_category" ON "business_expenses" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "idx_business_expenses_tenant_recurrence" ON "business_expenses" USING btree ("tenant_id","recurrence");--> statement-breakpoint
CREATE INDEX "idx_web_notifications_user" ON "web_notifications" USING btree ("tenant_id","user_id");