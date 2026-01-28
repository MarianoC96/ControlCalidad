import { createBrowserClient } from '@supabase/ssr';

// Non-typed client for flexibility with dynamic operations
// Uses fallback values during build when env vars may not be available
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

  return createBrowserClient(supabaseUrl, supabaseKey);
}
