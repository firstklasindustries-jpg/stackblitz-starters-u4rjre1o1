// lib/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; 
// Viktigt: SERVICE_ROLE_KEY ska bara användas på servern

export function getSupabaseServer() {
  return createClient(supabaseUrl, supabaseServiceKey);
}
