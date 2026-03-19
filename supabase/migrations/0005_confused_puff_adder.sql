CREATE TYPE "public"."dispatcher_pay_type" AS ENUM('fixed_salary', 'performance_revenue');--> statement-breakpoint
CREATE TYPE "public"."pay_frequency" AS ENUM('weekly', 'biweekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."payroll_period_status" AS ENUM('draft', 'approved', 'paid');--> statement-breakpoint
CREATE TABLE "chat_channel_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_chat_channel_reads_user_channel" UNIQUE("user_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "dispatcher_pay_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"pay_type" "dispatcher_pay_type" NOT NULL,
	"pay_rate" numeric(12, 2) NOT NULL,
	"pay_frequency" "pay_frequency" NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatcher_payroll_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"pay_type" "dispatcher_pay_type" NOT NULL,
	"pay_rate" numeric(12, 2) NOT NULL,
	"base_amount" numeric(12, 2) DEFAULT '0',
	"performance_amount" numeric(12, 2) DEFAULT '0',
	"total_amount" numeric(12, 2) DEFAULT '0',
	"order_count" integer DEFAULT 0,
	"total_order_revenue" numeric(12, 2) DEFAULT '0',
	"status" "payroll_period_status" DEFAULT 'draft' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "dispatched_by" uuid;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "chat_channel_reads" ADD CONSTRAINT "chat_channel_reads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_channel_reads" ADD CONSTRAINT "chat_channel_reads_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatcher_pay_configs" ADD CONSTRAINT "dispatcher_pay_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatcher_payroll_periods" ADD CONSTRAINT "dispatcher_payroll_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_channel_reads_user" ON "chat_channel_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dispatcher_pay_configs_tenant_id" ON "dispatcher_pay_configs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_dispatcher_pay_configs_tenant_user" ON "dispatcher_pay_configs" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_dispatcher_payroll_periods_tenant_id" ON "dispatcher_payroll_periods" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_dispatcher_payroll_periods_tenant_user" ON "dispatcher_payroll_periods" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_dispatcher_payroll_periods_tenant_status" ON "dispatcher_payroll_periods" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_dispatcher_payroll_periods_tenant_dates" ON "dispatcher_payroll_periods" USING btree ("tenant_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "idx_orders_tenant_dispatched_by" ON "orders" USING btree ("tenant_id","dispatched_by");