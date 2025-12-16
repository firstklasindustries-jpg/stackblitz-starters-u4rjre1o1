// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Throw ONLY when you actually call this function (runtime), not during build/import
  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!anon) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(url, anon);
}

// Backwards compatible export (if your UI imports `supabase`)
export const supabase = (() => {
  // Avoid crashing build if env missing during build time
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    // Return a dummy client to avoid build crash (will error if used without env)
    return createClient("http://localhost:54321", "public-anon-key");
  }

  return createClient(url, anon);
})();
