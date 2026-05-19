import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cuifxbinufnkevlsrios.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1aWZ4YmludWZua2V2bHNyaW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzk2OTAsImV4cCI6MjA5NDcxNTY5MH0.PwBy57iANjuthPtCWL2dYUrKInIjgC3BI181iJlrns0';

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