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

export async function GET(req: Request) {
  try {
    const supabase = getAdmin();
    if (!supabase) {
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

    const { data, error } = await supabase
      .from("machine_events")
      .select("id, machine_id, event_type, description, data, created_at, previous_hash, hash")
      .eq("machine_id", machineId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const list = (data || []) as any[];
    let prevHash: string | null = null;

    for (const ev of list) {
      if ((ev.previous_hash ?? null) !== prevHash) {
        return NextResponse.json({
          ok: true,
          verified: false,
          message: `Kedjan är bruten vid event ${String(ev.id).slice(0, 8)}…`,
        });
      }

      const payload = {
        machine_id: ev.machine_id,
        event_type: ev.event_type,
        description: ev.description,
        data: ev.data ?? null,
        previous_hash: prevHash,
      };

      const expected = sha256Hex(JSON.stringify(payload));

      if ((ev.hash ?? null) !== expected) {
        return NextResponse.json({
          ok: true,
          verified: false,
          message: `Kedjan är manipulerad vid event ${String(ev.id).slice(0, 8)}…`,
        });
      }

      prevHash = ev.hash ?? null;
    }

    return NextResponse.json({
      ok: true,
      verified: true,
      message: "Kedjan är intakt ✅",
      count: list.length,
    });
  } catch (e: any) {
    console.error("GET /api/machines/events/verify crashed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
