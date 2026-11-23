"use client";

import { createBrowserClient } from "@supabase/ssr";
import { envPublico } from "@/lib/env";
import type { Database } from "./tipos";

export function clienteSupabaseNavegador() {
  const env = envPublico();
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
