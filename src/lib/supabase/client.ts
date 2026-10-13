import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

// Browser client. Publishable key only — never a secret key here.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
