import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // viktigt för Buffer

function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { ok: false, error: "Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) return NextResponse.json({ ok: false, error: "No file" }, { status: 400 });

    // basic validation
    const maxBytes = 8 * 1024 * 1024; // 8 MB
    if (file.size > maxBytes) {
      return NextResponse.json({ ok: false, error: "Filen är för stor (max 8 MB)." }, { status: 400 });
    }
    if (!file.type?.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Endast bilder är tillåtna." }, { status: 400 });
    }

    const safeName = (file.name || "image").replace(/\s+/g, "-").replace(/[^\w.\-]/g, "");
    const filePath = `leads/${Date.now()}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("machine-images")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error(uploadError);
      return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
    }

    const { data } = supabaseAdmin.storage.from("machine-images").getPublicUrl(filePath);

    return NextResponse.json({ ok: true, publicUrl: data.publicUrl, path: filePath });
  } catch (e: any) {
    console.error("Upload lead image error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Upload failed" }, { status: 500 });
  }
}
