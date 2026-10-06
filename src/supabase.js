import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true
  }
});

// Cached company_id — fetched once per session
let cachedCompanyId = null;

async function getCompanyId() {
  if (cachedCompanyId) return cachedCompanyId;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', session.user.id)
    .maybeSingle();
  cachedCompanyId = data?.company_id || null;
  return cachedCompanyId;
}

export async function load(key) {
  try {
    const company_id = await getCompanyId();
    if (!company_id) return null;
    const { data } = await supabase
      .from('so_store')
      .select('value')
      .eq('company_id', company_id)
      .eq('key', key)
      .maybeSingle();
    return data ? JSON.parse(data.value) : null;
  } catch { return null; }
}

export async function save(key, value) {
  try {
    const company_id = await getCompanyId();
    if (!company_id) return;
    await supabase.from('so_store').upsert(
      { company_id, key, value: JSON.stringify(value), updated_at: new Date().toISOString() },
      { onConflict: 'company_id,key' }
    );
  } catch {}
}

export async function signIn(email, password) {
  cachedCompanyId = null;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  cachedCompanyId = null;
  await supabase.auth.signOut();
}