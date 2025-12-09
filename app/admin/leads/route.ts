// app/api/admin/leads/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase-miljövariabler saknas för admin/leads-API.");
}

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Supabase är inte konfigurerat" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("leads")
      .select(
        `
        id,
        name,
        email,
        phone,
        message,
        source,
        created_at,
        machines:machine_id (
          id,
          name,
          model,
          year,
          hours
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase admin/leads error:", error);
      return NextResponse.json(
        { ok: false, error: "Kunde inte hämta leads" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, leads: data ?? [] });
  } catch (err: any) {
    console.error("Ovnt. fel i admin/leads:", err);
    return NextResponse.json(
      { ok: false, error: "Oväntat fel i admin/leads" },
      { status: 500 }
    );
  }
}
