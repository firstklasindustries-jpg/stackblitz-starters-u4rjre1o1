// app/api/machines/create/route.ts
export const runtime = "nodejs";

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

    const year =
      typeof body.year === "number" && Number.isFinite(body.year) ? body.year : null;
    const hours =
      typeof body.hours === "number" && Number.isFinite(body.hours) ? body.hours : null;

    const insertRow = {
      name: typeof body.name === "string" ? body.name.trim() || null : null,
      model: typeof body.model === "string" ? body.model.trim() || null : null,
      serial_number:
        typeof body.serial_number === "string" ? body.serial_number.trim() || null : null,
      year,
      hours,
      image_url: typeof body.image_url === "string" ? body.image_url : null,
    };

    const { data, error } = await supabase
      .from("machines")
      .insert([insertRow])
      .select("id, name, model, serial_number, created_at, image_url, year, hours")
      .maybeSingle();

    if (error) {
      console.error("machines/create insert error:", error, { insertRow });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, machine: data });
  } catch (e: any) {
    console.error("machines/create server error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
