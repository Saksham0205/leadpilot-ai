import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function db() {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const missing = [
    ...(!url ? ['SUPABASE_URL'] : []),
    ...(!key ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
  ];
  if (!url || !key) {
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(', ')}. Configure your Supabase project in the server environment.`);
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}
