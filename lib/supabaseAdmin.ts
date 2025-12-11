// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// OBS: SUPABASE_SERVICE_ROLE_KEY måste vara satt i Vercel env
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
