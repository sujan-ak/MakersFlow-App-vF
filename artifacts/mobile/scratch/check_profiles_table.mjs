import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oodqutwsljhvuyotuthu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZHF1dHdzbGpodnV5b3R1dGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mjk3MDYsImV4cCI6MjA5NzEwNTcwNn0.XgxUO7bUC24GFziKvZCawVgUKRjxC7OGzSdu1aN3xL0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
  console.log('=== CHECKING PROFILES TABLE ===');
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, grade, school, age, onboarding_completed, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    console.log('Latest profiles in database:');
    console.log(JSON.stringify(profiles, null, 2));
  }
}

checkProfiles();
