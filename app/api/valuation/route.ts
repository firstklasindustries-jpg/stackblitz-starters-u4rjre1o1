// app/api/valuation/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const supabase = supabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const machineId = String(body.machineId || "");

    if (!machineId) {
      return NextResponse.json({ ok: false, error: "machineId krävs" }, { status: 400 });
    }

    // 1) Hämta maskin (så vi kan spara input snapshot)
    const { data: machine, error: mErr } = await supabase
      .from("machines")
      .select("id, name, model, year, hours, dpp_ready")
      .eq("id", machineId)
      .maybeSingle();

    if (mErr || !machine) {
      return NextResponse.json(
        { ok: false, error: mErr?.message || "Maskin hittades inte" },
        { status: 404 }
      );
    }

    // 2) Din värderingslogik (MVP-exempel – byt när du vill)
    const year = typeof body.year === "number" && Number.isFinite(body.year) ? body.year : machine.year;
    const hours = typeof body.hours === "number" && Number.isFinite(body.hours) ? body.hours : machine.hours;
    const conditionScore =
      typeof body.conditionScore === "number" && Number.isFinite(body.conditionScore)
        ? body.conditionScore
        : null;

    // SUPER-enkel MVP-beräkning (placeholder)
    const base = 500000;
    const agePenalty = year ? Math.max(0, (new Date().getFullYear() - year) * 12000) : 0;
    const hoursPenalty = hours ? Math.min(250000, Math.floor(hours / 50) * 900) : 0;
    const conditionBonus = conditionScore ? (conditionScore - 3) * 35000 : 0;

    const estimated_value = Math.max(50000, base - agePenalty - hoursPenalty + conditionBonus);
    const confidence = 55 + (conditionScore ? 10 : 0) + (year ? 10 : 0) + (hours ? 10 : 0);

    const result = {
      estimated_value,
      confidence: Math.max(10, Math.min(95, confidence)),
      comment: "MVP-estimat (byt till riktig modell när du vill).",
    };

    // 3) Kolla om vi redan sparat första snapshot
    const { data: existing, error: exErr } = await supabase
      .from("machine_events")
      .select("id")
      .eq("machine_id", machineId)
      .eq("event_type", "valuation_snapshot")
      .limit(1);

    if (exErr) {
      return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
    }

    const hasSnapshot = (existing || []).length > 0;

    // 4) Spara snapshot + sätt dpp_ready (bara första gången)
    if (!hasSnapshot) {
      const snapshotData = {
        input: { year, hours, conditionScore, model: machine.model },
        output: result,
        created_at: new Date().toISOString(),
      };

      const { error: evErr } = await supabase.from("machine_events").insert([
        {
          machine_id: machineId,
          event_type: "valuation_snapshot",
          description: `Första värdering sparad: ${estimated_value} NOK (${result.confidence}%)`,
          data: snapshotData,
          previous_hash: null,
          hash: null,
        },
      ]);

      if (evErr) {
        return NextResponse.json({ ok: false, error: evErr.message }, { status: 500 });
      }

      const { error: upErr } = await supabase
        .from("machines")
        .update({ dpp_ready: true })
        .eq("id", machineId);

      if (upErr) {
        return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      ...result,
      snapshot_saved: !hasSnapshot,
      dpp_ready: true,
    });
  } catch (e: any) {
    console.error("valuation error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
