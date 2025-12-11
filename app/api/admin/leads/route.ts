// app/api/admin/leads/route.ts
import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabaseClient";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, email, phone, message, source, created_at")
      .order("created_at", { ascending: false });

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
      {
        ok: false,
        error:
          err?.message || "Oväntat fel i servern vid hämtning av leads.",
      },
      { status: 500 }
    );
  }
}
