// app/api/admin/leads/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) return NextResponse.json({ ok: false, error: "Missing env: SUPABASE_URL" }, { status: 500 });
    if (!key) return NextResponse.json({ ok: false, error: "Missing env: SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });

    // optional protection
    const adminKey = process.env.ADMIN_KEY;
    if (adminKey) {
      const provided = req.headers.get("x-admin-key");
      if (provided !== adminKey) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from("leads")
      .select("id, created_at, name, email, phone, source, message, machine_type, status")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, leads: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
