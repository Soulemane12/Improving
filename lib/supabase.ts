import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function initSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  // Only create the client if the URL looks like a real Supabase URL
  try {
    new URL(url);
  } catch {
    return null;
  }

  return createClient(url, key);
}

export const supabase = initSupabase();
