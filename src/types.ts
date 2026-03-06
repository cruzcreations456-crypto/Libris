export interface User {
  id: string;
  username: string;
  bio: string;
  avatar: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  creator_id: string;
  creator_name: string;
  member_count: number;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  username: string;
  avatar: string;
  community_id: string | null;
  community_name: string | null;
  type: 'tweet' | 'review';
  content: string;
  book_title: string | null;
  rating: number | null;
  image_url: string | null;
  like_count: number;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  avatar: string;
  content: string;
  created_at: string;
}

export interface Recommendation {
  title: string;
  author: string;
  reason: string;
  genre: string;
  cover_url?: string;
}
