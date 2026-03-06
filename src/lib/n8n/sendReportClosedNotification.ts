'use client';

const N8N_NOTIFY_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_N8N_NOTIFY_WEBHOOK_URL ??
  "https://n8n.srv908725.hstgr.cloud/webhook/notificaciones";

interface UserInfo {
  id: string;
  full_name: string;
  email: string;
}

interface ReportClosedPayload {
  reportId: string;
  employee: UserInfo;
  supervisors: UserInfo[];
}

export async function sendReportClosedNotification(payload: ReportClosedPayload) {
  if (!N8N_NOTIFY_WEBHOOK_URL) {
    return { success: false as const };
  }

  const body = {
    type: "noti_cierre_e",
    noti_cierre_e: true,
    report_id: payload.reportId,
    employee: {
      id: payload.employee.id,
      nombre: payload.employee.full_name,
      email: payload.employee.email,
    },
    supervisors: payload.supervisors.map((s) => ({
      id: s.id,
      nombre: s.full_name,
      email: s.email,
    })),
  };

  try {
    const response = await fetch(N8N_NOTIFY_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error("N8N notify webhook error:", await response.text());
      return { success: false as const };
    }

    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // ignore JSON parse errors
    }

    return { success: true as const, data };
  } catch (error) {
    console.error("N8N notify webhook failed:", error);
    return { success: false as const };
  }
}

