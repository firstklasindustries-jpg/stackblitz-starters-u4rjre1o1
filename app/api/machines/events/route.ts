// app/api/machines/events/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      .select("*")
      .eq("machine_id", machineId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, events: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
