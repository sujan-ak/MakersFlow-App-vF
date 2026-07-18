import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oodqutwsljhvuyotuthu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZHF1dHdzbGpodnV5b3R1dGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mjk3MDYsImV4cCI6MjA5NzEwNTcwNn0.XgxUO7bUC24GFziKvZCawVgUKRjxC7OGzSdu1aN3xL0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('=== PRODUCTS TABLE ===');
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, title, thumbnail_url, images')
    .limit(10);
  
  if (prodErr) {
    console.error('Products fetch error:', prodErr);
  } else {
    console.log(JSON.stringify(products, null, 2));
  }

  console.log('=== PRODUCT_MEDIA TABLE ===');
  const { data: media, error: mediaErr } = await supabase
    .from('product_media')
    .select('*')
    .limit(10);

  if (mediaErr) {
    console.error('Product media fetch error:', mediaErr);
  } else {
    console.log(JSON.stringify(media, null, 2));
  }
}

checkDatabase();
