// app/actions/createMachineWithLead.ts
"use server";

import { getSupabaseServer } from "@/lib/supabaseServer";

export async function createMachineWithLead(formData: FormData) {
  const supabase = getSupabaseServer();

  // Fält från ditt formulär (namnen måste matcha inputs)
  const brand = (formData.get("brand") || "") as string;          // om du har brand
  const model = (formData.get("model") || "") as string;          // om du har model
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

  // 1) Skapa machine
  const { data: machine, error: machineError } = await supabase
    .from("machines")
    .insert({
      // justera till dina riktiga kolumnnamn här
      brand,              // ta bort om du inte har brand i DB
      model,              // ta bort om du inte har model i DB
      year,
      operating_hours: operatingHours, // byt till ditt namn om det heter ngt annat
      location_text: locationText,
      status: "active",
    })
    .select()
    .single();

  if (machineError || !machine) {
    console.error("Machine insert error:", machineError);
    throw new Error("Kunde inte skapa maskin");
  }

  // 2) Skapa valuation (om du vill logga det direkt)
  if (valueEstimate !== null) {
    const { error: valuationError } = await supabase.from("valuations").insert({
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
      // inte fatal, men bra att logga
    }
  }

  // 3) Skapa lead kopplat till maskin
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
    throw new Error("Kunde inte skapa lead");
  }

  // Du kan returnera något till client om du vill
  return { ok: true, machineId: machine.id };
}
