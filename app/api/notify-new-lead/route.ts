// app/api/notify-new-lead/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, machineInfo } = body;

    // Exempel med Resend-liknande API (pseudo)
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.warn("Ingen RESEND_API_KEY satt.");
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Arctic Trace <no-reply@dittdomän>",
        to: ["dinmail@adress.no"],
        subject: "Ny värderingsförfrågan",
        html: `
          <p>Ny lead från Arctic Trace:</p>
          <p><b>Namn:</b> ${name}</p>
          <p><b>E-post:</b> ${email}</p>
          <p><b>Telefon:</b> ${phone || "-"}</p>
          <p><b>Maskininfo:</b> ${machineInfo || "-"}</p>
        `,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Fel i notify-new-lead:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
