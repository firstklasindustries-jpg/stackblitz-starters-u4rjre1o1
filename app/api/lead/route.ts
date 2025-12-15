// app/api/lead/route.ts
import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Lead basics
    const name = String(body.name || "");
    const email = String(body.email || "");
    const phone = String(body.phone || "");
    const message = String(body.message || "");

    // Existing machine fields (hjullastare använder dessa)
    const brand = String(body.brand || "");
    const model = String(body.model || "");

    const year =
      typeof body.year === "number" && !Number.isNaN(body.year)
        ? body.year
        : null;

    const hours =
      typeof body.hours === "number" && !Number.isNaN(body.hours)
        ? body.hours
        : null;

    const locationText = String(body.locationText || "");

    const valueEstimate =
      typeof body.valueEstimate === "number" && !Number.isNaN(body.valueEstimate)
        ? body.valueEstimate
        : null;

    const conditionScore =
      typeof body.conditionScore === "number" && !Number.isNaN(body.conditionScore)
        ? body.conditionScore
        : null;

    // NEW (safe): optional machineType + payload (t.ex. grävmaskin)
    const machineType = String(body.machineType || body.machine_type || "");
    const machinePayload =
      body.machinePayload && typeof body.machinePayload === "object"
        ? body.machinePayload
        : body.machine_payload && typeof body.machine_payload === "object"
          ? body.machine_payload
          : null;

    // Build machine info (same as before + optional extras)
    const machineInfoParts = [
      machineType && `Machine type: ${machineType}`,
      brand && `Brand: ${brand}`,
      model && `Model: ${model}`,
      year && `Årsmodell: ${year}`,
      typeof hours === "number" && `Timmar: ${hours}`,
      locationText && `Plats: ${locationText}`,
      typeof valueEstimate === "number" && `Uppskattat värde: ${valueEstimate} NOK`,
      typeof conditionScore === "number" && `Skick (1–5): ${conditionScore}`,
    ].filter(Boolean);

    // If payload exists, include it in message (MVP-friendly, no DB changes)
    if (machinePayload) {
      machineInfoParts.push(`Payload: ${JSON.stringify(machinePayload)}`);
    }

    const machineInfo = machineInfoParts.join(" | ");

    const fullMessage =
      message.trim().length > 0
        ? `${message}\n\n---\n${machineInfo}`
        : machineInfo || "";

    const { data, error } = await supabase
      .from("leads")
      .insert({
        name,
        email,
        phone: phone || null,
        message: fullMessage || null,
        source: "valuation_form",
      })
      .select("id, created_at, source")
      .maybeSingle();

    if (error) {
      console.error("Lead insert error (server):", error);
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Kunde inte spara lead i databasen.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, lead: data });
  } catch (err: any) {
    console.error("Oväntat fel i POST /api/lead:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Oväntat fel i servern vid lead-inskick.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}
