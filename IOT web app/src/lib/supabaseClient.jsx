// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  globalThis.supabase ??
  createClient(supabaseUrl, supabaseAnonKey);

if (import.meta.env.DEV) {
  globalThis.supabase = supabase;
}
