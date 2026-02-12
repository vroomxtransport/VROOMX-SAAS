// Supabase Edge Function: send-bol-email
// Sends a BOL PDF via email using Resend.
// Expects: { to, orderNumber, pdfStoragePath, tenantName }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, orderNumber, pdfStoragePath, tenantName } = await req.json();

    if (!to || !pdfStoragePath) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, pdfStoragePath" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Download PDF from Supabase Storage using service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const storageUrl = `${supabaseUrl}/storage/v1/object/authenticated/bol-documents/${pdfStoragePath}`;
    const pdfResponse = await fetch(storageUrl, {
      headers: { Authorization: `Bearer ${serviceKey}` },
    });

    if (!pdfResponse.ok) {
      throw new Error(
        `Failed to download PDF from storage: ${pdfResponse.status}`
      );
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(
      String.fromCharCode(...new Uint8Array(pdfBuffer))
    );

    // Send via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    const senderName = tenantName || "VroomX Transport";
    const orderRef = orderNumber || "Unknown";

    const { data, error } = await resend.emails.send({
      from: `${senderName} <noreply@vroomx.com>`,
      to: [to],
      subject: `Bill of Lading - Order ${orderRef}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #3B82F6; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Bill of Lading</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0;">Order ${orderRef}</p>
          </div>
          <div style="padding: 24px; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.5;">
              Please find attached the Bill of Lading for Order <strong>${orderRef}</strong>.
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.5;">
              This document contains the vehicle inspection report, condition details, and signatures.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #6b7280; font-size: 14px;">
              Thank you for choosing ${senderName}.
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `BOL-${orderRef}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, emailId: data?.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("send-bol-email error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
