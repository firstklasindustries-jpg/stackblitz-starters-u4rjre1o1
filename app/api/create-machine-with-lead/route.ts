// app/api/create-machine-with-lead/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const supabase = getSupabaseServer();

  const formData = await req.formData();

  // Hämta fält från formuläret
  const brand = (formData.get("brand") || "") as string;
  const model = (formData.get("model") || "") as string;
  const year = formData.get("year") ? Number(formData.get("year")) : null;
  const operatingHours = formData.get("operating_hours")
    ? Number(formData.get("operating_hours"))
    : null;
  const locationText = (formData.get("location_text") || "") as string;

  const name = (formData.get("name") || "") as string;
  const email = (formData.get("email") || "") as string;
  const phone = (formData.get("phone") || "") as string;
  const message = (formData.get("message") || "") as string;

  const valueEstimate = formData.get("value_estimate")
    ? Number(formData.get("value_estimate"))
    : null;
  const conditionScore = formData.get("condition_score")
    ? Number(formData.get("condition_score"))
    : null;

  try {
    // 1) Skapa machine
    const { data: machine, error: machineError } = await supabase
      .from("machines")
      .insert({
        // anpassa till dina riktiga kolumnnamn
        brand,              // ta bort om du inte har "brand" i din DB
        model,              // ta bort om du inte har "model"
        year,
        operating_hours: operatingHours,
        location_text: locationText,
        status: "active",
      })
      .select()
      .single();

    if (machineError || !machine) {
      console.error("Machine insert error:", machineError);
      return NextResponse.json(
        { ok: false, error: "Kunde inte skapa maskin" },
        { status: 500 }
      );
    }

    // 2) Skapa valuation (om värde finns)
    if (valueEstimate !== null) {
      const { error: valuationError } = await supabase
        .from("valuations")
        .insert({
          machine_id: machine.id,
          method: "manual",
          currency: "NOK",
          value_estimate: valueEstimate,
          condition_score: conditionScore,
          input_snapshot: {
            formData: {
              brand,
              model,
              year,
              operating_hours: operatingHours,
              location_text: locationText,
            },
          },
        });

      if (valuationError) {
        console.error("Valuation insert error:", valuationError);
        // inte fatal, vi loggar bara
      }
    }

    // 3) Skapa lead kopplad till maskin
    const { error: leadError } = await supabase.from("leads").insert({
      machine_id: machine.id,
      name,
      email,
      phone,
      message,
      source: "valuation_form",
    });

    if (leadError) {
      console.error("Lead insert error:", leadError);
      return NextResponse.json(
        { ok: false, error: "Kunde inte skapa lead" },
        { status: 500 }
      );
    }

    // Lyckat: redirect tillbaka till startsidan (eller till /tack om du gör den sidan)
    return NextResponse.redirect(new URL("/", req.url));
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Något gick fel" },
      { status: 500 }
    );
  }
}

