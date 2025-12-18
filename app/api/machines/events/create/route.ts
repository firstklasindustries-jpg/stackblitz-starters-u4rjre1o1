export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function computeHash(input: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: Request) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
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

    if (!machine_id) return NextResponse.json({ ok: false, error: "Missing machine_id" }, { status: 400 });
    if (!event_type) return NextResponse.json({ ok: false, error: "Missing event_type" }, { status: 400 });
    if (!description) return NextResponse.json({ ok: false, error: "Missing description" }, { status: 400 });

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // last hash
    const { data: last, error: lastErr } = await supabase
      .from("machine_events")
      .select("hash")
      .eq("machine_id", machine_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (lastErr) {
      return NextResponse.json({ ok: false, error: lastErr.message }, { status: 500 });
    }

    const previous_hash = last && last.length > 0 ? last[0].hash : null;

    // IMPORTANT: hash payload must match verify route logic
    const hashPayload = {
      machine_id,
      event_type,
      description,
      data: null, // keep stable, same as your earlier MVP
      previous_hash,
    };

    const hash = await computeHash(JSON.stringify(hashPayload));

    const { error: insertErr } = await supabase.from("machine_events").insert([
      {
        machine_id,
        event_type,
        description,
        data, // store raw data (optional)
        previous_hash,
        hash,
      },
    ]);

    if (insertErr) {
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
