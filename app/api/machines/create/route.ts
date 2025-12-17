// app/api/machines/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const body = await req.json();

    const name = String(body.name || "").trim();
    const model = String(body.model || "").trim();
    const serial_number = String(body.serial_number || "").trim();

    const year =
      typeof body.year === "number" && Number.isFinite(body.year) ? body.year : null;

    const hours =
      typeof body.hours === "number" && Number.isFinite(body.hours) ? body.hours : null;

    if (!name || !model || !serial_number) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: name, model, serial_number" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("machines").insert([
      { name, model, serial_number, year, hours },
    ]);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
