// app/api/admin/leads/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
  }
  if (!key) {
    throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key);
}

export async function GET(req: Request) {
  try {
    // Optional: simple admin key protection (recommended)
    const adminKey = process.env.ADMIN_KEY;
    if (adminKey) {
      const provided = req.headers.get("x-admin-key");
      if (provided !== adminKey) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("leads")
      .select("id, created_at, name, email, phone, source, message, machine_type, status")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, leads: data });
  } catch (e: any) {
    // IMPORTANT: fail gracefully so build doesn’t crash
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

