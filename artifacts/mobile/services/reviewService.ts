import { supabase } from "@/lib/supabase";

export interface Review {
  id: string;
  user_id: string;
  course_id: number;
  rating: number;
  comment: string | null;
  status?: "pending" | "approved" | "rejected";
  created_at: string;
}

/** Fetch all reviews for a course, newest first */
export async function fetchCourseReviews(courseId: string | number): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, user_id, course_id, rating, comment, status, created_at")
    .eq("course_id", Number(courseId))
    .order("created_at", { ascending: false })
    .throwOnError();
  if (error) throw error;
  return data ?? [];
}

/** Fetch the current user's review for a course (or null) */
export async function fetchMyReview(
  userId: string,
  courseId: string | number
): Promise<Review | null> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, user_id, course_id, rating, comment, status, created_at")
    .eq("user_id", userId)
    .eq("course_id", Number(courseId))
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Insert or update the user's review (one per user per course) */
export async function upsertReview(
  userId: string,
  courseId: string | number,
  rating: number,
  comment: string
): Promise<void> {
  const { error } = await supabase.from("reviews").upsert(
    {
      user_id: userId,
      course_id: Number(courseId),
      rating,
      comment: comment.trim() || null,
    },
    { onConflict: "user_id,course_id" }
  );
  if (error) throw error;
}
