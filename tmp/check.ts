import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim() || '';
const envTestLocal = fs.readFileSync('.env.test.local', 'utf8');
const SUPABASE_SERVICE_ROLE_KEY = envTestLocal.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim() || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function check() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'beatlifedm@gmail.com');

  const { data: logs } = await supabase.from('daily_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(5);
  console.log("Recent logs:", logs.map(l => ({ date: l.date, hasWeight: l.weight !== null, hasWaist: l.waist !== null })));
}
check();
