import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oodqutwsljhvuyotuthu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZHF1dHdzbGpodnV5b3R1dGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mjk3MDYsImV4cCI6MjA5NzEwNTcwNn0.XgxUO7bUC24GFziKvZCawVgUKRjxC7OGzSdu1aN3xL0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function benchmark() {
  const { data: products } = await supabase.from('products').select('id').limit(1);
  if (!products || products.length === 0) {
    console.log("No product found to test");
    return;
  }
  const productId = products[0].id;
  const mockUserId = "00000000-0000-0000-0000-000000000000";

  console.log(`=== BENCHMARKING PRODUCT DETAIL QUERIES (Product ID: ${productId}) ===`);

  // BEFORE: Sequential (.then chains)
  const t0_before = performance.now();
  await supabase.from('product_media').select('*').eq('product_id', productId);
  await supabase.from('product_reviews').select('*').eq('product_id', productId);
  await supabase.from('product_reviews').select('*').eq('product_id', productId).eq('user_id', mockUserId);
  await supabase.from('orders').select('items').eq('user_id', mockUserId).in('status', ['paid', 'completed']);
  const t1_before = performance.now();
  const dur_before = (t1_before - t0_before).toFixed(2);
  console.log(`[BEFORE - Sequential Requests] Total Time: ${dur_before} ms`);

  // AFTER: Parallel (Promise.allSettled)
  const t0_after = performance.now();
  await Promise.allSettled([
    supabase.from('product_media').select('*').eq('product_id', productId),
    supabase.from('product_reviews').select('*').eq('product_id', productId),
    supabase.from('product_reviews').select('*').eq('product_id', productId).eq('user_id', mockUserId),
    supabase.from('orders').select('items').eq('user_id', mockUserId).in('status', ['paid', 'completed']),
  ]);
  const t1_after = performance.now();
  const dur_after = (t1_after - t0_after).toFixed(2);
  console.log(`[AFTER - Parallel Requests]   Total Time: ${dur_after} ms`);

  const speedup = (dur_before / dur_after).toFixed(2);
  console.log(`\n🚀 Speedup Factor: ${speedup}x faster (${(dur_before - dur_after).toFixed(2)} ms saved per screen load)`);

  const { data: courses } = await supabase.from('courses').select('id').limit(1);
  if (courses && courses.length > 0) {
    const courseId = courses[0].id;
    console.log(`\n=== BENCHMARKING COURSE DETAIL QUERIES (Course ID: ${courseId}) ===`);
    
    // BEFORE: Sequential
    const c0_before = performance.now();
    await supabase.from('modules').select('id').eq('course_id', courseId);
    await supabase.from('course_reviews').select('*').eq('course_id', courseId);
    await supabase.from('enrollments').select('*').eq('user_id', mockUserId).eq('course_id', courseId);
    await supabase.from('course_reviews').select('*').eq('course_id', courseId).eq('user_id', mockUserId);
    const c1_before = performance.now();
    const c_dur_before = (c1_before - c0_before).toFixed(2);
    console.log(`[BEFORE - Sequential Requests] Total Time: ${c_dur_before} ms`);

    // AFTER: Parallel
    const c0_after = performance.now();
    await Promise.allSettled([
      supabase.from('modules').select('id').eq('course_id', courseId),
      supabase.from('course_reviews').select('*').eq('course_id', courseId),
      supabase.from('enrollments').select('*').eq('user_id', mockUserId).eq('course_id', courseId),
      supabase.from('course_reviews').select('*').eq('course_id', courseId).eq('user_id', mockUserId),
    ]);
    const c1_after = performance.now();
    const c_dur_after = (c1_after - c0_after).toFixed(2);
    console.log(`[AFTER - Parallel Requests]   Total Time: ${c_dur_after} ms`);

    const c_speedup = (c_dur_before / c_dur_after).toFixed(2);
    console.log(`\n🚀 Speedup Factor: ${c_speedup}x faster (${(c_dur_before - c_dur_after).toFixed(2)} ms saved per screen load)`);
  }
}

benchmark();
