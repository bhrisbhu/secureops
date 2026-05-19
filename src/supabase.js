import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function load(key) {
  try {
    const { data } = await supabase
      .from('so_store')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    return data ? JSON.parse(data.value) : null;
  } catch { return null; }
}

export async function save(key, value) {
  try {
    await supabase.from('so_store').upsert(
      { key, value: JSON.stringify(value), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  } catch {}
}