export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED: string[] = ["new", "contacted", "in_progress", "won", "lost"];

export async function POST(req: Request) {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminKey = process.env.ADMIN_KEY || "";

    if (!url || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: "Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    // Auth
    const sentKey = req.headers.get("x-admin-key") || "";
    if (adminKey && sentKey !== adminKey) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = String(body.id || "").trim();
    const status = String(body.status || "").trim();

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }
    if (!ALLOWED.includes(status)) {
      return NextResponse.json(
        { ok: false, error: "Invalid status" },
        { status: 400 }
      );
    }

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, lead: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
