

import express from 'express';

import cors from 'cors';
import { connectDB, db } from './db.js';

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Logging middleware (move up to capture all requests)
app.use((req, res, next) => {
  console.log('Request URL:', req.url);
  next();
});

// Serve all frontend files
app.use(express.static(path.join(__dirname, '../frontend')));
console.log('Serving frontend from:', path.join(__dirname, '../frontend'));


// Explicitly serve api.js (so it doesn't get caught by the catch-all)
app.get('/api.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../../Petly/frontend/frontend/auth/api.js'));
});

// Connect MongoDB
connectDB();

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'PetCare API running' });
});

app.post('/api/register', async (req, res) => {
  const { name, email, password, petName, petType } = req.body;
  try {
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const result = await db.createUser({ name, email, password, petName, petType });
    if (!result.success) return res.status(500).json({ error: result.error });

    res.status(201).json({
      success: true,
      message: 'User registered',
      user: {
        id: result.user._id,
        name: result.user.name,
        email: result.user.email,
        petName: result.user.petName,
        petType: result.user.petType
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    user.lastActive = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        petName: user.petName,
        petType: user.petType
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all for SPA or frontend routing (keep last)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`PetCare backend running on http://localhost:${PORT}`));
