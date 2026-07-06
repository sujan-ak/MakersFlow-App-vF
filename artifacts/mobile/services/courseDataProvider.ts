import { supabase } from '@/lib/supabase';

export async function getCourseById(courseId: string) {
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, slug, category, level, price, is_free, thumbnail_url, description')
    .eq('id', Number(courseId))
    .eq('is_published', true)
    .single();
  if (error) throw error;
  return data;
}

export async function getCourseModules(courseId: string) {
  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select('id, title, order_index')
    .eq('course_id', Number(courseId))
    .order('order_index', { ascending: true });

  if (modulesError || !modules || modules.length === 0) return [];

  const moduleIds = modules.map((m) => m.id);
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, module_id, title, video_url, duration_secs, order_index')
    .in('module_id', moduleIds)
    .order('order_index', { ascending: true });

  return modules.map((m) => ({
    id: String(m.id),
    title: m.title,
    position: m.order_index ?? 0,
    lessons: (lessons ?? [])
      .filter((l) => l.module_id === m.id)
      .map((l) => ({
        id: String(l.id),
        title: l.title,
        video_url: l.video_url,
        duration_minutes: l.duration_secs ? Math.round(l.duration_secs / 60) : null,
        position: l.order_index ?? 0,
      })),
  }));
}

export async function fetchAllCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, category, level, price, is_free, thumbnail_url, slug')
    .eq('is_published', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

