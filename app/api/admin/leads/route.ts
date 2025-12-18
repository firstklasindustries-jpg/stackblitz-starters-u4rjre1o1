export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminKey = process.env.ADMIN_KEY || "";

    if (!url || !key) {
      return NextResponse.json(
        { ok: false, error: "Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    // ✅ ONE sentKey only
    const sentKey = req.headers.get("x-admin-key") || "";

    // ✅ debug (kan du ta bort sen)
    console.log("ADMIN LEADS AUTH", {
      hasEnvAdminKey: !!adminKey,
      sentLen: sentKey.length,
      sentPrefix: sentKey.slice(0, 6),
    });

    const sentKey = req.headers.get("x-admin-key") || "";

if (req.headers.get("x-admin-debug") === "1") {
  return NextResponse.json({
    ok: true,
    debug: {
      hasEnvAdminKey: !!adminKey,
      sentLen: sentKey.length,
      sentPrefix: sentKey.slice(0, 6),
    },
  });
}


    // ✅ MVP-skydd (om ADMIN_KEY är satt i env så krävs headern)
    if (adminKey && sentKey !== adminKey) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from("leads")
      .select("id, name, email, phone, message, source, created_at, machine_type, status")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, leads: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
