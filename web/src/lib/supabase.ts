import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const urlRaw =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined);

const keyRaw =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined);

const url = urlRaw?.trim();
const key = keyRaw?.trim();

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Null until env is configured — local prototype keeps working offline. */
export const supabase: SupabaseClient | null = (() => {
  if (!isHttpUrl(url) || !key) return null;
  try {
    return createClient(url, key);
  } catch (err) {
    console.error("Supabase client failed to init", err);
    return null;
  }
})();

export function isSupabaseConfigured(): boolean {
  return supabase != null;
}
