// app/api/lead/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function decodeJwtRole(jwt: string) {
  try {
    const payload = jwt.split(".")[1];
    const json = Buffer.from(payload, "base64").toString("utf8");
    const obj = JSON.parse(json);
    return obj?.role || null;
  } catch {
    return null;
  }
}

function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  console.log("LEAD ENV CHECK", {
    hasUrl: !!url,
    urlPrefix: url.slice(0, 25),
    keyRole: key ? decodeJwtRole(key) : null,
  });

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { ok: false, error: "Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json();

    // Lead basics
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const message = String(body.message || "").trim();

    if (!email) {
      return NextResponse.json({ ok: false, error: "Email krävs." }, { status: 400 });
    }

    // Common machine fields (works for wheel loader + excavator)
    const brand = String(body.brand || "").trim();
    const model = String(body.model || "").trim();
    const locationText = String(body.locationText || "").trim();

    const year =
      typeof body.year === "number" && Number.isFinite(body.year) ? body.year : null;

    const hours =
      typeof body.hours === "number" && Number.isFinite(body.hours) ? body.hours : null;

    const valueEstimate =
      typeof body.valueEstimate === "number" && Number.isFinite(body.valueEstimate)
        ? body.valueEstimate
        : null;

    const conditionScore =
      typeof body.conditionScore === "number" && Number.isFinite(body.conditionScore)
        ? body.conditionScore
        : null;

    // New: support both naming styles
    const machineType = String(body.machineType || body.machine_type || "").trim();

    const machinePayloadRaw = body.machinePayload ?? body.machine_payload ?? null;
    const machinePayload =
      machinePayloadRaw && typeof machinePayloadRaw === "object" ? machinePayloadRaw : null;

    // Excavator estimate fields (optional)
    const estimate_low =
      typeof body.estimate_low === "number" && Number.isFinite(body.estimate_low)
        ? body.estimate_low
        : null;

    const estimate_high =
      typeof body.estimate_high === "number" && Number.isFinite(body.estimate_high)
        ? body.estimate_high
        : null;

    const estimate_note =
      typeof body.estimate_note === "string" ? body.estimate_note : null;

    // Build a readable message (so you can always see what the user sent)
    const machineInfoParts = [
      machineType && `Machine type: ${machineType}`,
      brand && `Brand: ${brand}`,
      model && `Model: ${model}`,
      year !== null && `Årsmodell: ${year}`,
      hours !== null && `Timmar: ${hours}`,
      locationText && `Plats: ${locationText}`,
      valueEstimate !== null && `Uppskattat värde: ${valueEstimate} NOK`,
      conditionScore !== null && `Skick (1–5): ${conditionScore}`,
      estimate_low !== null && `Estimat low: ${estimate_low} NOK`,
      estimate_high !== null && `Estimat high: ${estimate_high} NOK`,
      estimate_note && `Estimat note: ${estimate_note}`,
      machinePayload && `Payload: ${JSON.stringify(machinePayload)}`,
    ].filter(Boolean);

    const machineInfo = machineInfoParts.join(" | ");

    const fullMessage =
      message.length > 0
        ? `${message}\n\n---\n${machineInfo}`
        : machineInfo || null;

    const insertRow: Record<string, any> = {
      name: name || null,
      email,
      phone: phone || null,
      message: fullMessage,
      source: "valuation_form",

      // If these columns exist (you showed they do), we store them too:
      machine_type: machineType || null,
      machine_payload: machinePayload ?? null,
      estimate_low,
      estimate_high,
      estimate_note,
    };

    const { error: insertError } = await supabaseAdmin.from("leads").insert(insertRow);

    if (insertError) {
      console.error("Lead insert error (admin):", insertError);
      return NextResponse.json(
        { ok: false, error: insertError.message || "Kunde inte spara lead i databasen." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Oväntat fel i POST /api/lead:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Oväntat fel i servern vid lead-inskick." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}
