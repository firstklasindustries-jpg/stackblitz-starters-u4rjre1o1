// app/api/lead/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function decodeJwtRole(jwt: string) {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;

    // base64url -> base64
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((payload.length + 3) % 4);

    // Node (runtime=nodejs): Buffer finns
    const json = Buffer.from(b64, "base64").toString("utf8");
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

  return createClient(url, key, { auth: { persistSession: false } });
}

// Hjälpare: validera heltal inom rimligt spann
function parseIntOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

// Hjälpare: validera nummer (float/int) inom rimligt spann
function parseNumberOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeImageUrls(body: any): string[] {
  // Godkänn flera naming styles
  const raw =
    body.image_urls ??
    body.imageUrls ??
    body.images ??
    body.image_url ??
    body.imageUrl ??
    null;

  if (!raw) return [];

  // String -> [string]
  if (typeof raw === "string") {
    const s = raw.trim();
    return s ? [s] : [];
  }

  // Array -> filter strings
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
  }

  return [];
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

    // Säkrare JSON parse
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Ogiltig JSON i request body." },
        { status: 400 }
      );
    }

    // ---- Lead basics ----
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim();
    const phone = String(body?.phone || "").trim();
    const message = String(body?.message || "").trim();

    if (!email) {
      return NextResponse.json({ ok: false, error: "Email krävs." }, { status: 400 });
    }

    // ---- Common machine fields ----
    const brand = String(body?.brand || "").trim();
    const model = String(body?.model || "").trim();
    const locationText = String(body?.locationText || body?.location_text || "").trim();

    // Year/hours: acceptera både number och string
    const nowYear = new Date().getFullYear();

    const year = parseIntOrNull(body?.year);
    if (year !== null && (year < 1950 || year > nowYear + 1)) {
      return NextResponse.json(
        { ok: false, error: `Årsmodell måste vara mellan 1950 och ${nowYear + 1}.` },
        { status: 400 }
      );
    }

    const hours = parseIntOrNull(body?.hours);
    if (hours !== null && (hours < 0 || hours > 200_000)) {
      return NextResponse.json(
        { ok: false, error: "Timmar måste vara mellan 0 och 200000." },
        { status: 400 }
      );
    }

    const valueEstimate = parseNumberOrNull(body?.valueEstimate);
    const conditionScore = parseNumberOrNull(body?.conditionScore);

    if (conditionScore !== null && (conditionScore < 1 || conditionScore > 5)) {
      return NextResponse.json(
        { ok: false, error: "Skick (1–5) måste vara mellan 1 och 5." },
        { status: 400 }
      );
    }

    // ---- Machine type + payload ----
    const machineType = String(body?.machineType || body?.machine_type || "").trim();

    const machinePayloadRaw = body?.machinePayload ?? body?.machine_payload ?? null;
    const machinePayload =
      machinePayloadRaw && typeof machinePayloadRaw === "object" && !Array.isArray(machinePayloadRaw)
        ? machinePayloadRaw
        : {};

    // ---- Images ----
    const imageUrls = normalizeImageUrls(body);

    // lägg in bilder i payload så du slipper schema-strul
    const mergedPayload = {
      ...machinePayload,
      images: imageUrls.length > 0 ? imageUrls : (machinePayload as any)?.images ?? [],
    };

    // ---- Estimate fields (optional) ----
    const estimate_low = parseNumberOrNull(body?.estimate_low);
    const estimate_high = parseNumberOrNull(body?.estimate_high);
    const estimate_note = typeof body?.estimate_note === "string" ? body.estimate_note : null;

    // ---- Build readable message (admin-friendly) ----
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
      imageUrls.length > 0 && `Bilder: ${imageUrls.join(", ")}`,
      Object.keys(mergedPayload || {}).length > 0 && `Payload: ${JSON.stringify(mergedPayload)}`,
    ].filter(Boolean);

    const machineInfo = machineInfoParts.join(" | ");

    const fullMessage =
      message.length > 0 ? `${message}\n\n---\n${machineInfo}` : machineInfo || null;

    const insertRow: Record<string, any> = {
      name: name || null,
      email,
      phone: phone || null,
      message: fullMessage,
      source: "valuation_form",

      machine_type: machineType || null,
      machine_payload: mergedPayload,

      estimate_low,
      estimate_high,
      estimate_note,
    };

    const { data, error: insertError } = await supabaseAdmin
      .from("leads")
      .insert(insertRow)
      .select("id, created_at")
      .maybeSingle();

    if (insertError) {
      console.error("Lead insert error (admin):", insertError);
      return NextResponse.json(
        { ok: false, error: insertError.message || "Kunde inte spara lead i databasen." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, lead: data ?? null });
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
