import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONGODB_URI = 'mongodb+srv://cruzcreations456_db_user:cruzcreations456_db_user@cluster0.5tkczbz.mongodb.net/book_community?appName=Cluster0';

// --- MONGODB MODELS ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  bio: { type: String, default: '' },
  avatar: { type: String }
}, { 
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const communitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  creator_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now }
}, { 
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const communityMemberSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  community_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true }
});

const postSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  community_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
  type: { type: String, default: 'tweet' },
  content: { type: String, required: true },
  book_title: { type: String },
  rating: { type: Number },
  image_url: { type: String },
  created_at: { type: Date, default: Date.now }
}, { 
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const likeSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true }
});

const commentSchema = new mongoose.Schema({
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
}, { 
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const User = mongoose.model('User', userSchema);
const Community = mongoose.model('Community', communitySchema);
const CommunityMember = mongoose.model('CommunityMember', communityMemberSchema);
const Post = mongoose.model('Post', postSchema);
const Like = mongoose.model('Like', likeSchema);
const Comment = mongoose.model('Comment', commentSchema);

export const app = express();

async function startServer() {
  // Connect to MongoDB
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000, 
      socketTimeoutMS: 45000,
    });
    console.log('[SERVER] Successfully connected to MongoDB');
  } catch (err: any) {
    console.error('[SERVER] MongoDB connection failed:', err.message);
    mongoose.set('bufferCommands', false);
  }

  app.use(express.json());

  // 1. GLOBAL MIDDLEWARE
  app.use((req, res, next) => {
    console.log(`[SERVER v2.0.0] ${req.method} ${req.url}`);
    if (req.url.startsWith('/api')) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });

  // 2. API ROUTES
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      dbConnected: mongoose.connection.readyState === 1, 
      type: 'mongodb',
      version: '2.0.0'
    });
  });

  app.get('/api/users', async (req, res) => {
    try {
      const users = await User.find({}, '-password');
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password, bio, avatar } = req.body;
      const existing = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
      if (existing) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      const newUser = new User({
        username,
        password,
        bio: bio || '',
        avatar: avatar || `https://picsum.photos/seed/${username}/100/100`
      });
      await newUser.save();
      const userObj = newUser.toJSON();
      delete userObj.password;
      res.json(userObj);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await User.findOne({ 
        username: new RegExp(`^${username}$`, 'i'), 
        password 
      });
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      const userObj = user.toJSON();
      delete userObj.password;
      res.json(userObj);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/communities', async (req, res) => {
    try {
      const communities = await Community.find().lean();
      const results = await Promise.all(communities.map(async (c: any) => {
        const creator = await User.findById(c.creator_id);
        const memberCount = await CommunityMember.countDocuments({ community_id: c._id });
        return {
          ...c,
          id: c._id.toString(),
          creator_name: creator ? creator.username : 'Unknown',
          member_count: memberCount
        };
      }));
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/communities', async (req, res) => {
    try {
      const { name, description, creator_id } = req.body;
      const newCommunity = new Community({ name, description, creator_id });
      await newCommunity.save();
      const newMember = new CommunityMember({ user_id: creator_id, community_id: newCommunity._id });
      await newMember.save();
      res.json({ id: newCommunity._id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/communities/join', async (req, res) => {
    try {
      const { user_id, community_id } = req.body;
      const exists = await CommunityMember.findOne({ user_id, community_id });
      if (exists) {
        return res.status(400).json({ error: 'Already a member' });
      }
      const newMember = new CommunityMember({ user_id, community_id });
      await newMember.save();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/posts', async (req, res) => {
    try {
      const { community_id } = req.query;
      let query = {};
      if (community_id) {
        query = { community_id };
      }

      const posts = await Post.find(query).sort({ created_at: -1 }).lean();
      const results = await Promise.all(posts.map(async (p: any) => {
        const user = await User.findById(p.user_id);
        const community = p.community_id ? await Community.findById(p.community_id) : null;
        const likeCount = await Like.countDocuments({ post_id: p._id });
        return {
          ...p,
          id: p._id.toString(),
          username: user ? user.username : 'Unknown',
          avatar: user ? user.avatar : null,
          community_name: community ? community.name : null,
          like_count: likeCount
        };
      }));
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/posts', async (req, res) => {
    try {
      const { user_id, community_id, type, content, book_title, rating, image_url } = req.body;
      const newPost = new Post({
        user_id,
        community_id: community_id || null,
        type: type || 'tweet',
        content,
        book_title: book_title || null,
        rating: rating || null,
        image_url: image_url || null
      });
      await newPost.save();
      res.json({ id: newPost._id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/posts/like', async (req, res) => {
    try {
      const { user_id, post_id } = req.body;
      const existing = await Like.findOne({ user_id, post_id });
      if (!existing) {
        const newLike = new Like({ user_id, post_id });
        await newLike.save();
        res.json({ success: true });
      } else {
        await Like.deleteOne({ _id: existing._id });
        res.json({ success: true, unliked: true });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/posts/:id/comments', async (req, res) => {
    try {
      const comments = await Comment.find({ post_id: req.params.id }).sort({ created_at: 1 }).lean();
      const results = await Promise.all(comments.map(async (c: any) => {
        const user = await User.findById(c.user_id);
        return {
          ...c,
          id: c._id.toString(),
          username: user ? user.username : 'Unknown',
          avatar: user ? user.avatar : null
        };
      }));
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/posts/:id/comments', async (req, res) => {
    try {
      const { user_id, content } = req.body;
      const newComment = new Comment({
        post_id: req.params.id,
        user_id,
        content
      });
      await newComment.save();
      res.json({ id: newComment._id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. API CATCH-ALL
  app.all('/api/*', (req, res) => {
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
      console.log(`Server v2.0.0 (MongoDB) running at http://localhost:${PORT}`);
    });
  }
}

startServer();
