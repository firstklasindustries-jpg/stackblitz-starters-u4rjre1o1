import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  try {
    const { machineId } = await req.json();

    const { data: machine, error } = await supabase
      .from("machines")
      .select("*")
      .eq("id", machineId)
      .single();

    if (error || !machine) {
      return NextResponse.json({ error: "Kunde inte läsa maskin" }, { status: 400 });
    }

    // === MVP REGLER ===
    let base = 500_000; // default basvärde

    // Justera bas på modell
    if (machine.model?.toLowerCase().includes("volvo")) base += 200_000;
    if (machine.model?.toLowerCase().includes("cat")) base += 150_000;

    // Årsmodell
    const yearFactor = Math.max(0.6, 1 - (2025 - machine.year) * 0.05);

    // Timmar
    let hourFactor = 1;
    if (machine.hours > 10_000) hourFactor -= 0.25;
    if (machine.hours < 3_000) hourFactor += 0.10;

    const finalFactor = yearFactor * hourFactor;
    const estimate = Math.round(base * finalFactor);

    const confidence = Math.round(70 + Math.random() * 20);

    // Spara
    const { data: valuation } = await supabase
      .from("valuations")
      .insert({
        machine_id: machine.id,
        estimated_value: estimate,
        confidence,
        comment: "Automatisk MVP-värdering baserat på modell, år & timmar.",
      })
      .select()
      .single();

    return NextResponse.json(valuation);

  } catch (err: any) {
    return NextResponse.json({
      error: err.message || "Internt serverfel",
    }, {status:500});
  }
}
