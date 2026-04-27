// src/lib/getDoulaId.ts
import { supabase } from '@/lib/supabaseClient';

export async function getDoulaId(): Promise<string> {
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch {}
  // Dev fallback (make sure it's set in .env.local)
  return process.env.NEXT_PUBLIC_USER_ID || '';
}
