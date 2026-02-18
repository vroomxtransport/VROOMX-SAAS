-- Web notifications for dashboard users
CREATE TABLE public.web_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_web_notifications_user ON public.web_notifications(tenant_id, user_id);
CREATE INDEX idx_web_notifications_unread ON public.web_notifications(tenant_id, user_id) WHERE read_at IS NULL;

ALTER TABLE public.web_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own notifications"
  ON public.web_notifications FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.web_notifications FOR UPDATE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid AND user_id = auth.uid());

CREATE POLICY "Server can insert notifications"
  ON public.web_notifications FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.web_notifications;
