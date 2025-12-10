// app/api/lead/route.ts
import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    // Kontakt / lead
    const name = String(formData.get("name") || "");
    const email = String(formData.get("email") || "");
    const phone = String(formData.get("phone") || "");
    const message = String(formData.get("message") || "");

    // Maskindata
    const brand = String(formData.get("brand") || "");
    const model = String(formData.get("model") || "");
    const year = formData.get("year")
      ? Number(formData.get("year"))
      : null;
    const hours = formData.get("operating_hours")
      ? Number(formData.get("operating_hours"))
      : null;
    const locationText = String(formData.get("location_text") || "");
    const valueEstimate = formData.get("value_estimate")
      ? Number(formData.get("value_estimate"))
      : null;
    const conditionScore = formData.get("condition_score")
      ? Number(formData.get("condition_score"))
      : null;

    // Bygg upp maskininfo som text i leadet
    const machineInfo = [
      brand && `Brand: ${brand}`,
      model && `Model: ${model}`,
      year && `Årsmodell: ${year}`,
      typeof hours === "number" && `Timmar: ${hours}`,
      locationText && `Plats: ${locationText}`,
      valueEstimate && `Uppskattat värde: ${valueEstimate} NOK`,
      conditionScore && `Skick (1–5): ${conditionScore}`,
    ]
      .filter(Boolean)
      .join(" | ");

    const fullMessage =
      (message || "").trim().length > 0
        ? `${message}\n\n---\n${machineInfo}`
        : machineInfo || "";

    // 1) Skapa lead i leads-tabellen
    const { error: leadError } = await supabase.from("leads").insert({
      name,
      email,
      phone: phone || null,
      message: fullMessage || null,
      source: "valuation_form",
    });

    if (leadError) {
      console.error("Lead insert error:", leadError);
      const url = new URL("/", req.url);
      url.searchParams.set("lead_error", "1");
      return NextResponse.redirect(url);
    }

    // 2) Allt ok → redirect tillbaka till startsidan med “sent=1”
    const url = new URL("/", req.url);
    url.searchParams.set("sent", "1");
    return NextResponse.redirect(url);
  } catch (err: any) {
    console.error("Unexpected error in POST /api/lead:", err);
    const url = new URL("/", req.url);
    url.searchParams.set("server_error", "1");
    return NextResponse.redirect(url);
  }
}

// Om någon surfar GET direkt på /api/lead
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST" },
    { status: 405 }
  );
}


