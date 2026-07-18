import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oodqutwsljhvuyotuthu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZHF1dHdzbGpodnV5b3R1dGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mjk3MDYsImV4cCI6MjA5NzEwNTcwNn0.XgxUO7bUC24GFziKvZCawVgUKRjxC7OGzSdu1aN3xL0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRls() {
  console.log('=== TESTING UPSERT ON PROFILES ===');
  // Check if upsert succeeds or fails due to RLS
  const dummyId = '00000000-0000-0000-0000-000000000000';
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: dummyId,
      full_name: 'Test Profile',
      email: 'test@example.com',
    })
    .select();

  console.log('Upsert result:', { data, error });
}

checkRls();
