import React, { useState, useEffect } from 'react';
import { User, Community, Post, Comment, Recommendation } from './types';
import { Book, Users, Home, Plus, MessageSquare, Heart, Search, LogOut, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

const CommentSection = ({ postId, currentUser }: { postId: string, currentUser: User }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchComments = async () => {
    const res = await fetch(`/api/posts/${postId}/comments`);
    if (res.ok) {
      const data = await res.json();
      setComments(data);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id, content: newComment })
    });
    setNewComment('');
    setIsSubmitting(false);
    fetchComments();
  };

  return (
    <div className="mt-6 pt-6 border-t border-brand-ink/5">
      <div className="space-y-4 mb-6">
        {comments.map((comment, idx) => (
          <div key={comment.id || `comment-${idx}`} className="flex gap-3">
            <img src={comment.avatar} alt={comment.username} className="w-8 h-8 rounded-full object-cover shrink-0" />
            <div className="bg-brand-cream p-3 rounded-2xl flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-xs">{comment.username}</span>
                <span className="text-[10px] opacity-40">{new Date(comment.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm leading-relaxed">{comment.content}</p>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-xs text-center opacity-40 italic py-2">No comments yet. Be the first to share a thought!</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 bg-brand-cream border-none rounded-xl px-4 py-2 text-sm focus:ring-2 ring-brand-olive"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || isSubmitting}
          className="bg-brand-olive text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 transition-opacity"
        >
          Post
        </button>
      </form>
    </div>
  );
};

interface PostCardProps {
  post: Post;
  currentUser: User;
  onLike: (id: string) => Promise<void>;
}

const PostCard: React.FC<PostCardProps> = ({ post, currentUser, onLike }) => {
  const [showComments, setShowComments] = useState(false);

  return (
    <article className="bg-white p-6 rounded-3xl border border-brand-ink/5 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 mb-4">
        <img src={post.avatar} alt={post.username} className="w-10 h-10 rounded-full object-cover" />
        <div>
          <p className="font-bold text-sm">{post.username}</p>
          <p className="text-xs opacity-40">{new Date(post.created_at).toLocaleDateString()}</p>
        </div>
        {post.community_name && (
          <span className="ml-auto text-[10px] uppercase tracking-widest font-bold bg-brand-cream px-2 py-1 rounded">
            in {post.community_name}
          </span>
        )}
      </div>
      
      {post.type === 'review' && (
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          {post.image_url && (
            <div className="w-full md:w-32 shrink-0">
              <img 
                src={post.image_url} 
                alt={post.book_title || 'Book cover'} 
                className="w-full aspect-[2/3] object-cover rounded-xl shadow-md"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-olive text-white rounded-full text-xs font-bold">
                REVIEW
              </div>
              {post.rating && (
                <div className="flex text-yellow-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={`star-${post.id}-${i}`} className={i < post.rating! ? 'fill-current' : 'opacity-20'}>★</span>
                  ))}
                </div>
              )}
            </div>
            <h4 className="text-2xl font-bold font-serif mb-2">{post.book_title}</h4>
            <p className="text-brand-ink/80 font-serif italic leading-relaxed">{post.content}</p>
          </div>
        </div>
      )}

      {post.type !== 'review' && (
        <p className="text-lg leading-relaxed mb-6 font-serif">{post.content}</p>
      )}

      <div className="flex items-center gap-6 pt-4 border-t border-brand-ink/5">
        <button 
          onClick={() => onLike(post.id)}
          className="flex items-center gap-2 text-sm hover:text-brand-olive transition-colors"
        >
          <Heart size={18} className={post.like_count > 0 ? 'fill-brand-olive text-brand-olive' : ''} />
          <span>{post.like_count}</span>
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-2 text-sm hover:text-brand-olive transition-colors ${showComments ? 'text-brand-olive' : ''}`}
        >
          <MessageSquare size={18} />
          <span>Comment</span>
        </button>
      </div>

      {showComments && <CommentSection postId={post.id} currentUser={currentUser} />}
    </article>
  );
};

const RecommendationsView = ({ currentUser, posts }: { currentUser: User | null, posts: Post[] }) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRecommendations = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      // Collect user context
      const userReviews = posts.filter(p => p.user_id === currentUser.id && p.type === 'review');
      const reviewContext = userReviews.map(r => `Book: ${r.book_title}, Rating: ${r.rating}/5, Review: ${r.content}`).join('\n');
      
      const prompt = `Based on the following user profile and reading history, recommend a long list of 15-20 books they might enjoy, categorized by genre.
      
      User Bio: ${currentUser.bio}
      
      User's Recent Reviews:
      ${reviewContext || "No reviews yet."}
      
      Please provide the recommendations in JSON format as an array of objects with the following structure for each book:
      {
        "title": "Book Title",
        "author": "Author Name",
        "genre": "Main Genre",
        "reason": "A personalized reason why this user would like it based on their bio/reviews"
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                author: { type: Type.STRING },
                genre: { type: Type.STRING },
                reason: { type: Type.STRING }
              },
              required: ["title", "author", "genre", "reason"]
            }
          }
        }
      });

      const data = JSON.parse(response.text || "[]");
      setRecommendations(data);
    } catch (err: any) {
      console.error("Failed to generate recommendations:", err);
      setError("The librarian is currently busy. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && recommendations.length === 0) {
      generateRecommendations();
    }
  }, [currentUser]);

  // Group recommendations by genre
  const groupedRecs = recommendations.reduce((acc, rec) => {
    const genre = rec.genre || 'Uncategorized';
    if (!acc[genre]) acc[genre] = [];
    acc[genre].push(rec);
    return acc;
  }, {} as Record<string, Recommendation[]>);

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-brand-olive/10 rounded-full flex items-center justify-center mb-6">
          <Sparkles size={40} className="text-brand-olive" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Personalized Recommendations</h3>
        <p className="text-brand-ink/60 max-w-md mx-auto italic mb-8">
          Sign in to get book recommendations tailored to your unique reading taste.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-3xl font-bold">The Grand Library Selection</h3>
          <p className="text-brand-ink/60 italic">A deep dive into your reading future, curated for {currentUser.username}.</p>
        </div>
        <button 
          onClick={generateRecommendations}
          disabled={isLoading}
          className="flex items-center gap-4 px-8 py-5 bg-[#5A5A40] text-white rounded-[32px] font-bold shadow-xl shadow-brand-olive/20 hover:scale-105 transition-all disabled:opacity-50"
        >
          <RefreshCw size={24} className={isLoading ? "animate-spin" : ""} />
          <div className="flex flex-col items-start leading-tight">
            <span className="text-lg">Refresh</span>
            <span className="text-sm opacity-80">Collection</span>
          </div>
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-12">
          {[1, 2].map(section => (
            <div key={section} className="space-y-6">
              <div className="h-8 bg-brand-cream rounded w-48 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-brand-ink/5 shadow-sm animate-pulse">
                    <div className="h-6 bg-brand-cream rounded w-3/4 mb-4" />
                    <div className="h-4 bg-brand-cream rounded w-1/2 mb-6" />
                    <div className="h-20 bg-brand-cream rounded w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white p-12 rounded-[40px] shadow-xl border border-brand-ink/5 text-center">
          <p className="text-brand-ink/70 mb-6">{error}</p>
          <button 
            onClick={generateRecommendations}
            className="bg-brand-olive text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-brand-olive/20"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="space-y-16">
          {(Object.entries(groupedRecs) as [string, Recommendation[]][]).map(([genre, recs], gIdx) => (
            <section key={genre} className="space-y-6">
              <div className="flex items-center gap-4">
                <h4 className="text-2xl font-serif font-bold text-brand-olive">{genre}</h4>
                <div className="h-px bg-brand-olive/20 flex-1" />
                <span className="text-xs font-bold uppercase tracking-widest opacity-40">{recs.length} BOOKS</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recs.map((rec, idx) => (
                  <motion.div 
                    key={`${genre}-${idx}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (gIdx * 0.1) + (idx * 0.05) }}
                    className="bg-[#D1D1D1] p-4 rounded-[40px] shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full"
                  >
                    <div className="bg-white p-6 rounded-[32px] flex flex-col h-full gap-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h5 className="text-xl font-bold font-serif leading-tight mb-1 group-hover:text-brand-olive transition-colors">{rec.title}</h5>
                          <p className="text-brand-ink/60 text-sm font-medium">by {rec.author}</p>
                        </div>
                        <div className="w-14 h-18 bg-brand-ink/5 rounded-lg border border-brand-ink/10 shrink-0" />
                      </div>
                      
                      <div className="mt-auto">
                        <div className="bg-white border border-brand-ink/5 p-4 rounded-2xl italic text-xs leading-relaxed text-brand-ink/80 shadow-sm">
                          "{rec.reason}"
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

const AuthView = ({ onAuthSuccess, onClose }: { onAuthSuccess: (user: User) => void, onClose: () => void }) => {
  const [mode, setMode] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const bio = formData.get('bio') as string;

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, bio })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onAuthSuccess(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white p-8 rounded-[40px] shadow-2xl border border-brand-ink/5 w-full max-w-md relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-brand-ink/40 hover:text-brand-ink transition-colors"
        >
          <Plus className="rotate-45" size={24} />
        </button>

        <div className="flex items-center gap-2 mb-8 justify-center">
          <Book className="text-brand-olive w-10 h-10" />
          <h1 className="text-4xl font-bold tracking-tight">Libris</h1>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'welcome' ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="text-center"
            >
              <h2 className="text-2xl font-serif font-bold mb-4">Your personal library awaits.</h2>
              <p className="text-brand-ink/60 mb-8 leading-relaxed italic">
                Connect with fellow readers, share your reviews, and discover your next favorite book.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setMode('login')}
                  className="bg-brand-olive text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-olive/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Log In
                </button>
                <button 
                  onClick={() => setMode('signup')}
                  className="bg-brand-cream text-brand-ink py-4 rounded-2xl font-bold hover:bg-brand-ink/5 transition-all"
                >
                  Create Account
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-2xl font-serif font-bold mb-6 text-center">
                {mode === 'login' ? 'Welcome Back' : 'Join the Library'}
              </h2>

              {error && (
                <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-sm mb-6 border border-red-100">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1 block">Username</label>
                  <input 
                    name="username" 
                    required
                    placeholder="Enter your username" 
                    className="w-full p-4 rounded-2xl bg-brand-cream border-none focus:ring-2 ring-brand-olive"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1 block">Password</label>
                  <input 
                    name="password" 
                    type="password"
                    required
                    placeholder="••••••••" 
                    className="w-full p-4 rounded-2xl bg-brand-cream border-none focus:ring-2 ring-brand-olive"
                  />
                </div>
                {mode === 'signup' && (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1 block">Bio (Optional)</label>
                    <textarea 
                      name="bio" 
                      placeholder="Tell us about your reading taste..." 
                      rows={2}
                      className="w-full p-4 rounded-2xl bg-brand-cream border-none focus:ring-2 ring-brand-olive resize-none"
                    />
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="bg-brand-olive text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-olive/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4 disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
                </button>
              </form>

              <div className="flex flex-col gap-4 mt-8">
                <p className="text-center text-sm text-brand-ink/60">
                  {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                  <button 
                    onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                    className="ml-2 text-brand-olive font-bold hover:underline"
                  >
                    {mode === 'login' ? 'Sign Up' : 'Log In'}
                  </button>
                </p>
                <button 
                  onClick={() => setMode('welcome')}
                  className="text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                >
                  ← Back to Welcome
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'feed' | 'communities' | 'community' | 'recommendations'>('feed');
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [postType, setPostType] = useState<'tweet' | 'review'>('tweet');
  const [isCreatingCommunity, setIsCreatingCommunity] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const savedUserId = localStorage.getItem('libris_user_id');
      
      // Fetch initial data
      await Promise.all([fetchCommunities(), fetchPosts()]);
      
      // If we have a saved user, try to fetch their profile
      if (savedUserId) {
        try {
          const res = await fetch('/api/users');
          if (res.ok) {
            const users = await res.json();
            const user = users.find((u: User) => u.id === savedUserId);
            if (user) setCurrentUser(user);
          }
        } catch (e) {
          console.error('Failed to restore session:', e);
        }
      }
      
      // Small delay to make the splash screen feel intentional but not annoying
      setTimeout(() => setIsLoading(false), 800);
    };
    init();
  }, []); // Only run once on mount

  useEffect(() => {
    // Polling for "real-time" updates
    const interval = setInterval(() => {
      if (view === 'feed') fetchPosts();
      if (view === 'communities') fetchCommunities();
      if (view === 'community' && selectedCommunity) fetchPosts(selectedCommunity.id);
    }, 10000);

    return () => clearInterval(interval);
  }, [view, selectedCommunity]);

  const handleAuthSuccess = (user: User) => {
    setDbError(null);
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    localStorage.setItem('libris_user_id', user.id);
    // Data is already being fetched or will be fetched by the polling/view changes
    // But let's ensure fresh data for the new user
    fetchCommunities();
    fetchPosts();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('libris_user_id');
    setView('feed');
  };

  const fetchCommunities = async () => {
    try {
      const res = await fetch('/api/communities');
      const text = await res.text();
      
      if (!res.ok) {
        try {
          const err = JSON.parse(text);
          setDbError(err.error || 'Failed to fetch communities');
        } catch (e) {
          setDbError(`Server error (${res.status}): ${text.substring(0, 100)}...`);
        }
        return;
      }

      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          setCommunities(data);
          setDbError(null);
        }
      } catch (e) {
        console.error('Failed to parse communities JSON:', text.substring(0, 100));
        setDbError('Received invalid data format from server. Please refresh.');
      }
    } catch (err) {
      console.error('Error fetching communities:', err);
    }
  };

  const fetchPosts = async (communityId?: string) => {
    try {
      const url = communityId ? `/api/posts?community_id=${communityId}` : '/api/posts';
      const res = await fetch(url);
      const contentType = res.headers.get("content-type");
      
      const text = await res.text();
      
      if (!res.ok) {
        try {
          const err = JSON.parse(text);
          setDbError(err.error || 'Failed to fetch posts');
        } catch (e) {
          setDbError(`Server error (${res.status}): ${text.substring(0, 100)}...`);
        }
        return;
      }

      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          setPosts(data);
          setDbError(null);
        }
      } catch (e) {
        console.error('Failed to parse posts JSON:', text.substring(0, 100));
        setDbError('Received invalid data format from server. Please refresh.');
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
    }
  };

  const handleCreatePost = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    const formData = new FormData(e.currentTarget);
    const content = formData.get('content') as string;
    const book_title = formData.get('book_title') as string;
    const rating = formData.get('rating') ? parseInt(formData.get('rating') as string) : null;
    const image_url = formData.get('image_url') as string;

    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        community_id: selectedCommunity?.id || null,
        type: postType,
        content,
        book_title: postType === 'review' ? book_title : null,
        rating: postType === 'review' ? rating : null,
        image_url: postType === 'review' ? image_url : null
      })
    });
    setIsCreatingPost(false);
    setPostType('tweet');
    fetchPosts(selectedCommunity?.id);
  };

  const handleCreateCommunity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    await fetch('/api/communities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        creator_id: currentUser.id
      })
    });
    setIsCreatingCommunity(false);
    fetchCommunities();
  };

  const handleJoinCommunity = async (communityId: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    await fetch('/api/communities/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id, community_id: communityId })
    });
    fetchCommunities();
  };

  const handleLike = async (postId: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    await fetch('/api/posts/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id, post_id: postId })
    });
    fetchPosts(selectedCommunity?.id);
  };

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div 
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen bg-brand-cream flex flex-col items-center justify-center p-8 text-center"
        >
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mb-6"
          >
            <Book size={48} className="text-brand-olive" />
          </motion.div>
          <h2 className="text-2xl font-serif font-bold mb-2">Opening the Library...</h2>
          <p className="text-brand-ink/60 italic">Dusting off the shelves and organizing the scrolls.</p>
        </motion.div>
      ) : dbError ? (
        <motion.div 
          key="error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-h-screen bg-brand-cream flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto"
        >
          <div className="bg-white p-12 rounded-[40px] shadow-xl border border-brand-ink/5">
            <div className="w-20 h-20 bg-brand-olive/10 rounded-full flex items-center justify-center mx-auto mb-8">
              <Search size={40} className="text-brand-olive" />
            </div>
            <h2 className="text-4xl font-serif font-bold mb-4">Database Connection Required</h2>
            <p className="text-lg text-brand-ink/70 mb-8 leading-relaxed">
              {dbError}
            </p>
            
            <button 
              onClick={() => window.location.reload()}
              className="bg-brand-olive text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-brand-olive/20 hover:scale-105 transition-transform"
            >
              Retry Connection
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-h-screen flex flex-col md:flex-row w-full"
        >
          {/* Sidebar */}
          <aside className="w-full md:w-64 bg-white border-r border-brand-ink/10 p-6 flex flex-col gap-8">
            <div className="flex items-center gap-2">
              <Book className="text-brand-olive w-8 h-8" />
              <h1 className="text-3xl font-bold tracking-tight">Libris</h1>
            </div>

            <nav className="flex flex-col gap-2">
              <button 
                onClick={() => { setView('feed'); setSelectedCommunity(null); }}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${view === 'feed' ? 'bg-brand-olive text-white' : 'hover:bg-brand-cream'}`}
              >
                <Home size={20} />
                <span className="font-medium">Home Feed</span>
              </button>
              <button 
                onClick={() => setView('communities')}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${view === 'communities' ? 'bg-brand-olive text-white' : 'hover:bg-brand-cream'}`}
              >
                <Users size={20} />
                <span className="font-medium">Communities</span>
              </button>
              <button 
                onClick={() => setView('recommendations')}
                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${view === 'recommendations' ? 'bg-brand-olive text-white' : 'hover:bg-brand-cream'}`}
              >
                <Book size={20} />
                <span className="font-medium">Recommendations</span>
              </button>
            </nav>

            <div className="mt-auto pt-6 border-t border-brand-ink/10">
              {currentUser ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <img src={currentUser.avatar} alt={currentUser.username} className="w-10 h-10 rounded-full object-cover border border-brand-ink/10" />
                    <div>
                      <p className="font-bold text-sm">{currentUser.username}</p>
                      <p className="text-xs opacity-60">Reader</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 transition-colors font-bold text-sm"
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-2">Join the Community</p>
                  <button 
                    onClick={() => setIsAuthModalOpen(true)}
                    className="w-full bg-brand-olive text-white p-3 rounded-xl font-bold text-sm shadow-lg shadow-brand-olive/10 hover:scale-[1.02] transition-transform"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => setIsAuthModalOpen(true)}
                    className="w-full bg-brand-cream text-brand-ink p-3 rounded-xl font-bold text-sm hover:bg-brand-ink/5 transition-colors"
                  >
                    Create Account
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full">
            <header className="flex flex-col gap-4 mb-8">
              {view === 'community' && (
                <button 
                  onClick={() => { setView('communities'); setSelectedCommunity(null); }}
                  className="flex items-center gap-2 text-sm font-bold text-brand-olive hover:underline w-fit"
                >
                  ← Back to Communities
                </button>
              )}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-4xl font-bold">
                    {view === 'feed' ? 'Your Library Feed' : 
                     view === 'communities' ? 'Explore Communities' : 
                     view === 'recommendations' ? 'Book Recommendations' :
                     selectedCommunity?.name}
                  </h2>
                  <p className="text-brand-ink/60 italic mt-1">
                    {view === 'feed' ? 'What your fellow readers are saying...' : 
                     view === 'communities' ? 'Find your tribe of bibliophiles.' : 
                     view === 'recommendations' ? 'Personalized picks from our AI librarian.' :
                     selectedCommunity?.description}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {view === 'community' && (
                    <span className="hidden md:block text-xs font-bold uppercase tracking-widest opacity-40">
                      Posting in {selectedCommunity?.name}
                    </span>
                  )}
                  {view !== 'recommendations' && (
                    <button 
                      onClick={() => view === 'communities' ? setIsCreatingCommunity(true) : setIsCreatingPost(true)}
                      className="bg-brand-olive text-white p-3 rounded-full shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                    >
                      <Plus size={24} />
                      <span className="hidden md:inline pr-2 font-bold">
                        {view === 'communities' ? 'New Community' : 'New Post'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </header>

            <AnimatePresence mode="wait">
              {view === 'communities' ? (
                <motion.div 
                  key="view-communities"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {communities.map((c, idx) => (
                    <div key={c.id || `community-${idx}`} className="bg-white p-6 rounded-3xl border border-brand-ink/5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-2xl font-bold">{c.name}</h3>
                        <span className="text-xs bg-brand-cream px-2 py-1 rounded-full">{c.member_count} members</span>
                      </div>
                      <p className="text-sm text-brand-ink/70 mb-6 line-clamp-2">{c.description}</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setSelectedCommunity(c); setView('community'); }}
                          className="flex-1 bg-brand-cream py-2 rounded-xl font-medium text-sm hover:bg-brand-ink hover:text-white transition-colors"
                        >
                          View
                        </button>
                        <button 
                          onClick={() => handleJoinCommunity(c.id)}
                          className="flex-1 border border-brand-olive text-brand-olive py-2 rounded-xl font-medium text-sm hover:bg-brand-olive hover:text-white transition-colors"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              ) : view === 'recommendations' ? (
                <motion.div
                  key="view-recommendations"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <RecommendationsView currentUser={currentUser} posts={posts} />
                </motion.div>
              ) : (
                <motion.div 
                  key={`view-${view}-${selectedCommunity?.id || 'all'}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-6"
                >
                  {posts.map((post: Post, idx) => (
                    <PostCard 
                      key={post.id || `post-${idx}`} 
                      post={post} 
                      currentUser={currentUser} 
                      onLike={handleLike} 
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Modals */}
          <AnimatePresence>
            {isAuthModalOpen && (
              <motion.div
                key="modal-auth"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="z-[100]"
              >
                <AuthView 
                  onAuthSuccess={handleAuthSuccess} 
                  onClose={() => setIsAuthModalOpen(false)} 
                />
              </motion.div>
            )}

            {isCreatingPost && (
              <motion.div 
                key="modal-create-post"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl"
                >
                  <div className="flex gap-4 mb-6 border-b border-brand-ink/10 pb-4">
                    <button 
                      onClick={() => setPostType('tweet')}
                      className={`flex-1 py-2 rounded-xl font-bold transition-all ${postType === 'tweet' ? 'bg-brand-olive text-white shadow-lg' : 'hover:bg-brand-cream'}`}
                    >
                      Tweet
                    </button>
                    <button 
                      onClick={() => setPostType('review')}
                      className={`flex-1 py-2 rounded-xl font-bold transition-all ${postType === 'review' ? 'bg-brand-olive text-white shadow-lg' : 'hover:bg-brand-cream'}`}
                    >
                      Book Review
                    </button>
                  </div>

                  <h3 className="text-2xl font-bold mb-2">
                    {postType === 'tweet' ? 'What\'s on your mind?' : 'Share your review'}
                  </h3>
                  {selectedCommunity && (
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-olive mb-6">
                      Posting to {selectedCommunity.name}
                    </p>
                  )}
                  {!selectedCommunity && <div className="mb-6" />}

                  <form onSubmit={handleCreatePost} className="flex flex-col gap-4">
                    {postType === 'review' && (
                      <>
                        <input 
                          name="book_title" 
                          required
                          placeholder="Book Title" 
                          className="w-full p-4 rounded-2xl bg-brand-cream border-none focus:ring-2 ring-brand-olive"
                        />
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <label className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1 block">Rating</label>
                            <select 
                              name="rating" 
                              className="w-full p-4 rounded-2xl bg-brand-cream border-none focus:ring-2 ring-brand-olive"
                            >
                              <option value="5">5 Stars</option>
                              <option value="4">4 Stars</option>
                              <option value="3">3 Stars</option>
                              <option value="2">2 Stars</option>
                              <option value="1">1 Star</option>
                            </select>
                          </div>
                          <div className="flex-[2]">
                            <label className="text-xs font-bold uppercase tracking-widest opacity-50 mb-1 block">Cover Image URL</label>
                            <input 
                              name="image_url" 
                              placeholder="https://..." 
                              className="w-full p-4 rounded-2xl bg-brand-cream border-none focus:ring-2 ring-brand-olive"
                            />
                          </div>
                        </div>
                      </>
                    )}
                    
                    <textarea 
                      name="content" 
                      required 
                      placeholder={postType === 'tweet' ? "Share a thought, a quote, or a quick update..." : "What did you think of this book?"}
                      rows={4}
                      className="w-full p-4 rounded-2xl bg-brand-cream border-none focus:ring-2 ring-brand-olive resize-none"
                    />

                    <div className="flex gap-3 mt-4">
                      <button 
                        type="button" 
                        onClick={() => setIsCreatingPost(false)}
                        className="flex-1 py-3 rounded-2xl font-bold hover:bg-brand-cream transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 bg-brand-olive text-white py-3 rounded-2xl font-bold shadow-lg shadow-brand-olive/20 hover:scale-105 transition-transform"
                      >
                        {postType === 'tweet' ? 'Post Tweet' : 'Post Review'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}

            {isCreatingCommunity && (
              <motion.div 
                key="modal-create-community"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl"
                >
                  <h3 className="text-3xl font-bold mb-6">Start a Community</h3>
                  <form onSubmit={handleCreateCommunity} className="flex flex-col gap-4">
                    <input 
                      name="name" 
                      required
                      placeholder="Community Name" 
                      className="w-full p-4 rounded-2xl bg-brand-cream border-none focus:ring-2 ring-brand-olive"
                    />
                    <textarea 
                      name="description" 
                      required 
                      placeholder="What is this group about?" 
                      rows={3}
                      className="w-full p-4 rounded-2xl bg-brand-cream border-none focus:ring-2 ring-brand-olive resize-none"
                    />
                    <div className="flex gap-3 mt-4">
                      <button 
                        type="button" 
                        onClick={() => setIsCreatingCommunity(false)}
                        className="flex-1 py-3 rounded-2xl font-bold hover:bg-brand-cream transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 bg-brand-olive text-white py-3 rounded-2xl font-bold shadow-lg shadow-brand-olive/20 hover:scale-105 transition-transform"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
