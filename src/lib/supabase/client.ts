import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseUrl } from './url';

export function createClient() {
  return createBrowserClient(
    getSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 7, // 7일
        path: '/',
        sameSite: 'lax',
      },
    }
  );
}
