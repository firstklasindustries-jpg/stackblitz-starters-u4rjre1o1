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

    const { error } = await supabase.from("machines").insert([
      {
        name: body.name ?? null,
        model: body.model ?? null,
        serial_number: body.serial_number ?? null,
        year: typeof body.year === "number" ? body.year : null,
        hours: typeof body.hours === "number" ? body.hours : null,
        image_url: body.image_url ?? null, // <-- VIKTIG
      },
    ]);

    if (error) {
      console.error("machines/create insert error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("machines/create server error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
