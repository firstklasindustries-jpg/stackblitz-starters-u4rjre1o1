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

export async function GET(req: Request) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { ok: false, error: "Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const machineId = searchParams.get("machineId");

    if (!machineId) {
      return NextResponse.json({ ok: false, error: "Missing machineId" }, { status: 400 });
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from("machine_events")
      .select("id, machine_id, event_type, description, created_at, previous_hash, hash")
      .eq("machine_id", machineId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const list = (data || []) as any[];

    let prev: string | null = null;

    for (const ev of list) {
      // check chain pointer
      if ((ev.previous_hash || null) !== prev) {
        return NextResponse.json({
          ok: true,
          verified: false,
          message: `Kedjan är bruten vid event ${String(ev.id).slice(0, 8)}…`,
        });
      }

      // recompute expected hash (must match create route)
      const hashPayload = {
        machine_id: ev.machine_id,
        event_type: ev.event_type,
        description: ev.description,
        data: null, // stable
        previous_hash: prev,
      };

      const expected = await computeHash(JSON.stringify(hashPayload));

      if (ev.hash !== expected) {
        return NextResponse.json({
          ok: true,
          verified: false,
          message: `Hash mismatch vid event ${String(ev.id).slice(0, 8)}…`,
        });
      }

      prev = ev.hash;
    }

    return NextResponse.json({
      ok: true,
      verified: true,
      message: list.length === 0 ? "Inga events att verifiera." : "Kedjan är intakt ✅",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
