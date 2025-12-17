import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LeadStatus = "new" | "contacted" | "in_progress" | "won" | "lost";

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, { auth: { persistSession: false } });
}

function isValidStatus(s: any): s is LeadStatus {
  return ["new", "contacted", "in_progress", "won", "lost"].includes(String(s));
}

export async function PATCH(req: Request) {
  try {
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

    const body = await req.json();
    const id = String(body.id || "");
    const status = body.status;

    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }
    if (!isValidStatus(status)) {
      return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
    }

    const { error } = await supabase.from("leads").update({ status }).eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

