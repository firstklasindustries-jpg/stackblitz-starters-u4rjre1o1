// app/api/lead/route.ts
import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const name = String(body.name || "");
    const email = String(body.email || "");
    const phone = String(body.phone || "");
    const message = String(body.message || "");

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
      typeof body.valueEstimate === "number" &&
      !Number.isNaN(body.valueEstimate)
        ? body.valueEstimate
        : null;
    const conditionScore =
      typeof body.conditionScore === "number" &&
      !Number.isNaN(body.conditionScore)
        ? body.conditionScore
        : null;

    const machineInfo = [
      brand && `Brand: ${brand}`,
      model && `Model: ${model}`,
      year && `Årsmodell: ${year}`,
      typeof hours === "number" && `Timmar: ${hours}`,
      locationText && `Plats: ${locationText}`,
      typeof valueEstimate === "number" &&
        `Uppskattat värde: ${valueEstimate} NOK`,
      typeof conditionScore === "number" &&
        `Skick (1–5): ${conditionScore}`,
    ]
      .filter(Boolean)
      .join(" | ");

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
          error:
            error.message ||
            "Kunde inte spara lead i databasen.",
        },
        { status: 500 }
      );
    }

    console.log("Lead sparad (server):", data);

    return NextResponse.json({ ok: true, lead: data });
  } catch (err: any) {
    console.error("Oväntat fel i POST /api/lead:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err?.message ||
          "Oväntat fel i servern vid lead-inskick.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST" },
    { status: 405 }
  );
}
