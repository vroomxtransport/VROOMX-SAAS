CREATE TABLE "order_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"action" text NOT NULL,
	"description" text NOT NULL,
	"actor_id" uuid,
	"actor_email" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_activity_logs" ADD CONSTRAINT "order_activity_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_activity_logs" ADD CONSTRAINT "order_activity_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_order_activity_logs_tenant_order" ON "order_activity_logs" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "idx_order_activity_logs_created" ON "order_activity_logs" USING btree ("order_id","created_at");--> statement-breakpoint

-- Enable RLS
ALTER TABLE "order_activity_logs" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: tenant isolation for SELECT
CREATE POLICY "order_activity_logs_select_policy"
  ON "order_activity_logs"
  FOR SELECT
  USING (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid);

-- RLS Policy: tenant isolation for INSERT
CREATE POLICY "order_activity_logs_insert_policy"
  ON "order_activity_logs"
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid);
