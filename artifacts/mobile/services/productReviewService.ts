import { supabase } from "@/lib/supabase";

export interface ProductReview {
  id: string;
  user_id: string;
  product_id: number;
  rating: number;
  comment: string | null;
  status?: "pending" | "approved" | "rejected";
  created_at: string;
}

/** Fetch all reviews for a product, newest first */
export async function fetchProductReviews(productId: string | number): Promise<ProductReview[]> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, user_id, product_id, rating, comment, status, created_at")
    .eq("product_id", Number(productId))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Fetch the current user's review for a product (or null) */
export async function fetchMyProductReview(
  userId: string,
  productId: string | number
): Promise<ProductReview | null> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, user_id, product_id, rating, comment, status, created_at")
    .eq("user_id", userId)
    .eq("product_id", Number(productId))
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** Insert or update the user's review (one per user per product) */
export async function upsertProductReview(
  userId: string,
  productId: string | number,
  rating: number,
  comment: string
): Promise<void> {
  const { error } = await supabase.from("product_reviews").upsert(
    {
      user_id: userId,
      product_id: Number(productId),
      rating,
      comment: comment.trim() || null,
    },
    { onConflict: "user_id,product_id" }
  );
  if (error) throw error;
}
