export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getAdmin() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  try {
    const supabase = getAdmin();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const machine_id = String(body.machine_id || "").trim();
    const event_type = String(body.event_type || "").trim();
    const description = String(body.description || "").trim();
    const data = body.data ?? null;

    if (!machine_id || !event_type || !description) {
      return NextResponse.json(
        { ok: false, error: "Missing required: machine_id, event_type, description" },
        { status: 400 }
      );
    }

    // Get last hash for machine
    const { data: lastEvents, error: lastError } = await supabase
      .from("machine_events")
      .select("hash")
      .eq("machine_id", machine_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (lastError) {
      return NextResponse.json({ ok: false, error: lastError.message }, { status: 500 });
    }

    const previous_hash =
      lastEvents && lastEvents.length > 0 ? (lastEvents[0].hash as string | null) : null;

    // Build payload and compute hash
    const payload = {
      machine_id,
      event_type,
      description,
      data: data ?? null,
      previous_hash,
    };

    const hash = sha256Hex(JSON.stringify(payload));

    const { error: insertError } = await supabase.from("machine_events").insert([
      {
        ...payload,
        hash,
      },
    ]);

    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("POST /api/machines/events/create crashed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
