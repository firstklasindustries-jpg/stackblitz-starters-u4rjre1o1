// app/api/admin/leads/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function GET(req: Request) {
  try {
    // Protect endpoint with ADMIN_KEY (you already have it in Vercel)
    const adminKey = process.env.ADMIN_KEY;
    if (adminKey) {
      const provided = req.headers.get("x-admin-key");
      if (provided !== adminKey) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = getAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .select("id, name, email, phone, message, source, created_at, machine_type, status")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Supabase admin/leads error:", error);
      return NextResponse.json(
        { ok: false, error: error.message || "Kunde inte hämta leads." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, leads: data ?? [] });
  } catch (err: any) {
    console.error("Oväntat fel i admin/leads:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Oväntat fel i servern vid hämtning av leads." },
      { status: 500 }
    );
  }
}
