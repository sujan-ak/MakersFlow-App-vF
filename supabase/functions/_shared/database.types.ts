export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: number
          price: number
          original_price: number | null
          is_course: boolean
          course_id: number | null
          weight: number
          stock: number
        }
        Insert: {
          id?: number
          price: number
          original_price?: number | null
          is_course?: boolean
          course_id?: number | null
          weight?: number
          stock?: number
        }
        Update: {
          id?: number
          price?: number
          original_price?: number | null
          is_course?: boolean
          course_id?: number | null
          weight?: number
          stock?: number
        }
      }
      orders: {
        Row: {
          id: number
          user_id: string
          total_amount: number
          status: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          promo_code: string | null
          discount_amount: number | null
          tax_amount: number | null
          shipping_address: Json | null
          items: Json | null
          shipment_status: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          total_amount: number
          status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          promo_code?: string | null
          discount_amount?: number | null
          tax_amount?: number | null
          shipping_address?: Json | null
          items?: Json | null
          shipment_status?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          total_amount?: number
          status?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          promo_code?: string | null
          discount_amount?: number | null
          tax_amount?: number | null
          shipping_address?: Json | null
          items?: Json | null
          shipment_status?: string | null
          created_at?: string
        }
      }
      enrollments: {
        Row: {
          id: number
          user_id: string
          course_id: number
          payment_status: string
          status: string
          enrolled_at: string
          expires_at: string
        }
        Insert: {
          id?: number
          user_id: string
          course_id: number
          payment_status?: string
          status?: string
          enrolled_at?: string
          expires_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          course_id?: number
          payment_status?: string
          status?: string
          enrolled_at?: string
          expires_at?: string
        }
      }
      whatsapp_otps: {
        Row: {
          id: number
          phone: string
          code_hash: string
          attempts: number
          used_at: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: number
          phone: string
          code_hash: string
          attempts?: number
          used_at?: string | null
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: number
          phone?: string
          code_hash?: string
          attempts?: number
          used_at?: string | null
          expires_at?: string
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          phone: string | null
          full_name: string | null
          avatar_url: string | null
        }
        Insert: {
          id: string
          email?: string | null
          phone?: string | null
          full_name?: string | null
          avatar_url?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          phone?: string | null
          full_name?: string | null
          avatar_url?: string | null
        }
      }
    }
  }
}
