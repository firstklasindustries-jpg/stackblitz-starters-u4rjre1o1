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

    const name = String(body.name || "").trim();
    const model = String(body.model || "").trim();
    const serial_number = String(body.serial_number || "").trim();

    if (!name || !model || !serial_number) {
      return NextResponse.json(
        { ok: false, error: "Missing name/model/serial_number" },
        { status: 400 }
      );
    }

    const year =
      typeof body.year === "number" && Number.isFinite(body.year) ? body.year : null;

    const hours =
      typeof body.hours === "number" && Number.isFinite(body.hours) ? body.hours : null;

    const image_url =
      typeof body.image_url === "string" && body.image_url.trim().length > 0
        ? body.image_url.trim()
        : null;

    const row = {
      name,
      model,
      serial_number,
      year,
      hours,
      image_url, // ✅ här ska den vara
    };

    const { data, error } = await supabase
      .from("machines")
      .insert(row)
      .select("id, created_at, image_url")
      .maybeSingle();

    if (error) {
      console.error("machines/create insert error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, machine: data });
  } catch (e: any) {
    console.error("machines/create error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}
