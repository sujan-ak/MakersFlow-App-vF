// Database types for authentication and user profiles
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  grade?: string | null;
  school?: string | null;
  avatar_url?: string | null;
  age?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
  };
}
