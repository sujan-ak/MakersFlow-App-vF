import { supabase } from '@/lib/supabase';

const newsThumbnails = [
  require('@/assets/images/news_1.png'),
  require('@/assets/images/news_2.png'),
  require('@/assets/images/news_3.png'),
  require('@/assets/images/news_4.png'),
  require('@/assets/images/news_5.png'),
];

const getDeterministicThumbnail = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % newsThumbnails.length;
  return newsThumbnails[index];
};

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  author: string;
  date: string;
  readTime: string;
  thumbnail: any;
  tags: string[];
}

export async function fetchAllNews(): Promise<NewsArticle[]> {
  const { data, error } = await supabase
    .from('news')
    .select('id, title, slug, content, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[newsService] Error fetching news:', error);
    throw error;
  }

  if (!data || data.length === 0) return [];

  return data.map((row: any) => {
    const rawContent = row.content || "";
    // Clean markdown/HTML snippets for summary
    const cleanText = rawContent
      .replace(/[#*`_\[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const summary = cleanText
      ? (cleanText.substring(0, 110) + (cleanText.length > 110 ? "..." : ""))
      : "Stay updated with the latest news and announcements from MakersFlow.";

    const wordCount = rawContent.split(/\s+/).length || 0;
    const readMinutes = Math.max(1, Math.round(wordCount / 200));

    // Format date: Jun 6, 2026
    const formattedDate = new Date(row.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return {
      id: String(row.id),
      title: row.title,
      content: rawContent,
      summary,
      category: "Announcement",
      author: "MakersFlow Team",
      date: formattedDate,
      readTime: `${readMinutes} min read`,
      thumbnail: getDeterministicThumbnail(String(row.id)),
      tags: ["MakersFlow", "Update"],
    };
  });
}

export async function fetchNewsById(id: string): Promise<NewsArticle | null> {
  const { data, error } = await supabase
    .from('news')
    .select('id, title, slug, content, created_at')
    .eq('id', id)
    .single();

  if (error) {
    console.error(`[newsService] Error fetching news article ${id}:`, error);
    throw error;
  }

  if (!data) return null;

  const rawContent = data.content || "";
  const cleanText = rawContent
    .replace(/[#*`_\[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const summary = cleanText
    ? (cleanText.substring(0, 110) + (cleanText.length > 110 ? "..." : ""))
    : "Stay updated with the latest news and announcements from MakersFlow.";

  const wordCount = rawContent.split(/\s+/).length || 0;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));

  const formattedDate = new Date(data.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return {
    id: String(data.id),
    title: data.title,
    content: rawContent,
    summary,
    category: "Announcement",
    author: "MakersFlow Team",
    date: formattedDate,
    readTime: `${readMinutes} min read`,
    thumbnail: getDeterministicThumbnail(String(data.id)),
    tags: ["MakersFlow", "Update"],
  };
}
