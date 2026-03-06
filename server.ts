import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- IN-MEMORY DUMMY DATABASE ---
const db = {
  users: [] as any[],
  communities: [] as any[],
  community_members: [] as any[],
  posts: [] as any[],
  likes: [] as any[],
  comments: [] as any[]
};

// Seed Data
const seed = () => {
  console.log('Seeding initial dummy data...');
  const aliceId = randomUUID();
  const bobId = randomUUID();
  const communityId = randomUUID();

  db.users.push(
    { id: aliceId, username: 'Alice', password: 'password', bio: 'Avid reader of sci-fi.', avatar: 'https://picsum.photos/seed/alice/100/100' },
    { id: bobId, username: 'Bob', password: 'password', bio: 'History buff.', avatar: 'https://picsum.photos/seed/bob/100/100' }
  );

  db.communities.push({
    id: communityId,
    name: 'Sci-Fi Explorers',
    description: 'Discussing the future and beyond.',
    creator_id: aliceId,
    created_at: new Date().toISOString()
  });

  db.community_members.push({ user_id: aliceId, community_id: communityId });

  db.posts.push({
    id: randomUUID(),
    user_id: aliceId,
    community_id: communityId,
    type: 'review',
    content: 'Just finished Dune. Mind blown!',
    book_title: 'Dune',
    rating: 5,
    image_url: null,
    created_at: new Date().toISOString()
  });
  console.log('Seeding complete');
};

seed();

export const app = express();

async function startServer() {
  app.use(express.json());

  // 1. GLOBAL MIDDLEWARE
  app.use((req, res, next) => {
    console.log(`[SERVER v1.2.2] ${req.method} ${req.url} (original: ${req.originalUrl})`);
    // Force JSON for all /api requests to prevent HTML fallback parsing errors
    if (req.url.startsWith('/api')) {
      console.log(`[SERVER] API request detected: ${req.url}`);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });

  // 2. API ROUTES
  app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working with In-Memory Dummy DB', timestamp: new Date().toISOString() });
  });

  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      dbConnected: true, 
      type: 'in-memory',
      version: '1.2.3'
    });
  });

  app.get('/api/users', (req, res) => {
    // Don't send passwords
    res.json(db.users.map(({ password, ...u }) => u));
  });

  app.post('/api/auth/register', (req, res) => {
    const { username, password, bio, avatar } = req.body;
    if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const id = randomUUID();
    const newUser = {
      id,
      username,
      password,
      bio: bio || '',
      avatar: avatar || `https://picsum.photos/seed/${username}/100/100`
    };
    db.users.push(newUser);
    const { password: _, ...userWithoutPassword } = newUser;
    res.json(userWithoutPassword);
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  app.get('/api/communities', (req, res) => {
    const results = db.communities.map(c => {
      const creator = db.users.find(u => u.id === c.creator_id);
      const memberCount = db.community_members.filter(m => m.community_id === c.id).length;
      return {
        ...c,
        creator_name: creator ? creator.username : 'Unknown',
        member_count: memberCount
      };
    });
    res.json(results);
  });

  app.post('/api/communities', (req, res) => {
    const { name, description, creator_id } = req.body;
    const id = randomUUID();
    const newCommunity = {
      id,
      name,
      description,
      creator_id,
      created_at: new Date().toISOString()
    };
    db.communities.push(newCommunity);
    db.community_members.push({ user_id: creator_id, community_id: id });
    res.json({ id });
  });

  app.post('/api/communities/join', (req, res) => {
    const { user_id, community_id } = req.body;
    const exists = db.community_members.some(m => m.user_id === user_id && m.community_id === community_id);
    if (exists) {
      return res.status(400).json({ error: 'Already a member' });
    }
    db.community_members.push({ user_id, community_id });
    res.json({ success: true });
  });

  app.get('/api/posts', (req, res) => {
    const { community_id } = req.query;
    console.log(`[API] Fetching posts for community: ${community_id || 'all'}`);
    let filteredPosts = db.posts;
    if (community_id) {
      filteredPosts = db.posts.filter(p => p.community_id === community_id);
    }

    const results = filteredPosts.map(p => {
      const user = db.users.find(u => u.id === p.user_id);
      const community = db.communities.find(c => c.id === p.community_id);
      const likeCount = db.likes.filter(l => l.post_id === p.id).length;
      return {
        ...p,
        username: user ? user.username : 'Unknown',
        avatar: user ? user.avatar : null,
        community_name: community ? community.name : null,
        like_count: likeCount
      };
    });
    
    // Sort by date descending
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(results);
  });

  app.post('/api/posts', (req, res) => {
    const { user_id, community_id, type, content, book_title, rating, image_url } = req.body;
    const id = randomUUID();
    const newPost = {
      id,
      user_id,
      community_id: community_id || null,
      type: type || 'tweet',
      content,
      book_title: book_title || null,
      rating: rating || null,
      image_url: image_url || null,
      created_at: new Date().toISOString()
    };
    db.posts.push(newPost);
    res.json({ id });
  });

  app.post('/api/posts/like', (req, res) => {
    const { user_id, post_id } = req.body;
    const index = db.likes.findIndex(l => l.user_id === user_id && l.post_id === post_id);
    if (index === -1) {
      db.likes.push({ user_id, post_id });
      res.json({ success: true });
    } else {
      db.likes.splice(index, 1);
      res.json({ success: true, unliked: true });
    }
  });

  app.get('/api/posts/:id/comments', (req, res) => {
    const results = db.comments
      .filter(c => c.post_id === req.params.id)
      .map(c => {
        const user = db.users.find(u => u.id === c.user_id);
        return {
          ...c,
          username: user ? user.username : 'Unknown',
          avatar: user ? user.avatar : null
        };
      });
    
    // Sort by date ascending
    results.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    res.json(results);
  });

  app.post('/api/posts/:id/comments', (req, res) => {
    const { user_id, content } = req.body;
    const id = randomUUID();
    const newComment = {
      id,
      post_id: req.params.id,
      user_id,
      content,
      created_at: new Date().toISOString()
    };
    db.comments.push(newComment);
    res.json({ id });
  });

  // 3. API CATCH-ALL
  app.all('/api/*', (req, res) => {
    console.warn(`[API 404] ${req.method} ${req.url}`);
    res.status(404).json({ error: `API endpoint ${req.method} ${req.url} not found` });
  });

  // 4. VITE / STATIC ASSETS
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server v1.2.3 (In-Memory Dummy DB) running at http://localhost:${PORT}`);
    });
  }
}

startServer();
