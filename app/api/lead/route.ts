// app/api/leads/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body.name || "");
    const email = String(body.email || "");
    const phone = String(body.phone || "");
    const message = String(body.message || "");

    // Common machine fields (works for wheel loader + excavator)
    const brand = String(body.brand || "");
    const model = String(body.model || "");
    const locationText = String(body.locationText || "");

    const year =
      typeof body.year === "number" && !Number.isNaN(body.year) ? body.year : null;

    const hours =
      typeof body.hours === "number" && !Number.isNaN(body.hours) ? body.hours : null;

    const valueEstimate =
      typeof body.valueEstimate === "number" && !Number.isNaN(body.valueEstimate)
        ? body.valueEstimate
        : null;

    const conditionScore =
      typeof body.conditionScore === "number" && !Number.isNaN(body.conditionScore)
        ? body.conditionScore
        : null;

    const machineType = String(body.machineType || body.machine_type || "");
    const machinePayload =
      body.machinePayload && typeof body.machinePayload === "object"
        ? body.machinePayload
        : body.machine_payload && typeof body.machine_payload === "object"
          ? body.machine_payload
          : null;

    // Build message (so you can still read everything even if you don’t store payload columns)
    const machineInfoParts = [
      machineType && `Machine type: ${machineType}`,
      brand && `Brand: ${brand}`,
      model && `Model: ${model}`,
      year && `Årsmodell: ${year}`,
      typeof hours === "number" && `Timmar: ${hours}`,
      locationText && `Plats: ${locationText}`,
      typeof valueEstimate === "number" && `Uppskattat värde: ${valueEstimate} NOK`,
      typeof conditionScore === "number" && `Skick (1–5): ${conditionScore}`,
      machinePayload && `Payload: ${JSON.stringify(machinePayload)}`,
    ].filter(Boolean);

    const machineInfo = machineInfoParts.join(" | ");
    const fullMessage =
      message.trim().length > 0
        ? `${message}\n\n---\n${machineInfo}`
        : machineInfo || "";

    if (!email.trim()) {
      return NextResponse.json({ ok: false, error: "Email krävs." }, { status: 400 });
    }

    const { error: insertError } = await supabaseAdmin.from("leads").insert({
      name: name || null,
      email: email.trim(),
      phone: phone.trim() || null,
      message: fullMessage || null,
      source: "valuation_form",

      // If you have these columns (you showed you do), we store them nicely too:
      machine_type: machineType || null,
      machine_payload: machinePayload ?? null,
      estimate_low:
        typeof body.estimate_low === "number" && !Number.isNaN(body.estimate_low)
          ? body.estimate_low
          : null,
      estimate_high:
        typeof body.estimate_high === "number" && !Number.isNaN(body.estimate_high)
          ? body.estimate_high
          : null,
      estimate_note: typeof body.estimate_note === "string" ? body.estimate_note : null,
    });

    if (insertError) {
      console.error("Lead insert error (admin):", insertError);
      return NextResponse.json(
        { ok: false, error: insertError.message || "Kunde inte spara lead." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Oväntat fel i POST /api/leads:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Oväntat fel i servern." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}
