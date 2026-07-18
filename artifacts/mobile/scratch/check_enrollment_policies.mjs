import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oodqutwsljhvuyotuthu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZHF1dHdzbGpodnV5b3R1dGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mjk3MDYsImV4cCI6MjA5NzEwNTcwNn0.XgxUO7bUC24GFziKvZCawVgUKRjxC7OGzSdu1aN3xL0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  console.log('=== CHECKING ENROLLMENT POLICIES IN DB ===');
  // Attempt to select from pg_policies via RPC or query
  const { data, error } = await supabase.rpc('get_policies_for_table', { table_name: 'enrollments' });
  if (error) {
    console.log('RPC not available, testing client insert for user...');
  } else {
    console.log('Policies:', data);
  }
}

checkPolicies();
