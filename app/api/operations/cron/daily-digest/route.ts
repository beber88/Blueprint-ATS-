import { NextRequest, NextResponse } from "next/server";
import { getOperationsStats } from "@/lib/operations/queries";
import { signDigestToken } from "@/lib/operations/digest";
import { sendWhatsApp } from "@/lib/twilio/client";
import { sendEmail } from "@/lib/gmail/client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

function buildEmailHtml(stats: Awaited<ReturnType<typeof getOperationsStats>>, link: string): string {
  const { kpis } = stats;
  const today = new Date().toISOString().slice(0, 10);
  const topAlerts = stats.alerts.slice(0, 10);
  const topThemes = stats.recurringThemes.slice(0, 5);

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1A1A1A; max-width: 720px; margin: 0 auto;">
      <h1 style="color: #C9A84C;">דיגסט יומי — תפעול</h1>
      <p style="color: #6B6356;">תאריך: ${today}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 12px; background: #FAF8F5; border-radius: 8px;"><b>פתוחים:</b> ${kpis.open}</td>
          <td style="padding: 12px;"><b>איחור:</b> ${kpis.overdue}</td>
          <td style="padding: 12px; background: #FAF8F5; border-radius: 8px;"><b>דחופים:</b> ${kpis.urgent}</td>
        </tr>
        <tr>
          <td style="padding: 12px;"><b>החלטות מנכ"ל:</b> ${kpis.ceo_pending}</td>
          <td style="padding: 12px; background: #FAF8F5; border-radius: 8px;"><b>מידע חסר:</b> ${kpis.missing_info}</td>
          <td style="padding: 12px;"><b>התראות פתוחות:</b> ${kpis.alerts}</td>
        </tr>
      </table>

      <h2 style="color: #1A1A1A;">התראות מובילות</h2>
      ${topAlerts.length === 0 ? "<p>אין התראות פתוחות.</p>" : `
        <ul>
          ${topAlerts.map(a => `<li><b>[${a.type} / ${a.severity}]</b> ${a.message}</li>`).join("")}
        </ul>
      `}

      ${topThemes.length === 0 ? "" : `
        <h2 style="color: #1A1A1A;">בעיות חוזרות (30 יום)</h2>
        <ul>
          ${topThemes.map(t => `<li>${t.theme} <span style="color:#8A7D6B;">(${t.occurrence_count}×)</span></li>`).join("")}
        </ul>
      `}

      <p style="margin-top: 24px;">
        <a href="${link}" style="display: inline-block; padding: 10px 16px; background: #C9A84C; color: #1A1A1A; text-decoration: none; border-radius: 8px; font-weight: 600;">
          צפייה בדיגסט המלא
        </a>
      </p>
      <p style="font-size: 12px; color: #8A7D6B;">קישור זה תקף ל-24 שעות.</p>
    </div>
  `;
}

function buildWhatsAppSummary(stats: Awaited<ReturnType<typeof getOperationsStats>>, link: string): string {
  const { kpis } = stats;
  const today = new Date().toISOString().slice(0, 10);
  return [
    `📊 דיגסט תפעול — ${today}`,
    "",
    `פתוחים: ${kpis.open}`,
    `איחור: ${kpis.overdue}`,
    `דחופים: ${kpis.urgent}`,
    `החלטות מנכ"ל: ${kpis.ceo_pending}`,
    `מידע חסר: ${kpis.missing_info}`,
    `התראות: ${kpis.alerts}`,
    "",
    `דיגסט מלא: ${link}`,
  ].join("\n");
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stats = await getOperationsStats();

  const token = signDigestToken(stats);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "http://localhost:3000";
  const baseWithProtocol = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  const link = `${baseWithProtocol}/hr/operations/digest/${token}`;

  const ceoEmail = process.env.OPERATIONS_CEO_EMAIL;
  const ceoWhatsApp = process.env.OPERATIONS_CEO_WHATSAPP;

  const results: Record<string, unknown> = { link, sent_email: false, sent_whatsapp: false };

  if (ceoEmail) {
    try {
      await sendEmail(ceoEmail, `דיגסט תפעול יומי — ${new Date().toISOString().slice(0, 10)}`, buildEmailHtml(stats, link));
      results.sent_email = true;
    } catch (e) {
      console.error("daily-digest: email failed", e);
      results.email_error = e instanceof Error ? e.message : String(e);
    }
  }

  if (ceoWhatsApp) {
    try {
      await sendWhatsApp(ceoWhatsApp, buildWhatsAppSummary(stats, link));
      results.sent_whatsapp = true;
    } catch (e) {
      console.error("daily-digest: whatsapp failed", e);
      results.whatsapp_error = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}

export const POST = GET;
