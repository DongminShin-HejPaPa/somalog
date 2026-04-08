import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: user } = await supabase.from('users').select('id').eq('email', 'beatlifedm@gmail.com').single();
  if (!user) return console.log('user not found');
  
  // Unclose 3/1
  const { error } = await supabase
    .from('daily_logs')
    .upsert({ user_id: user.id, date: '2026-03-01', closed: false });
    
  if (error) console.error(error);
  else console.log('Successfully unclosed 2026-03-01');
}

run();
