const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/User.model.js');
const { body, validationResult } = require('express-validator');

// Real-time registration with WebSocket
const WebSocket = require('ws');
const wss = new WebSocket.Server({ noServer: true });

// Store connected admin clients
const adminClients = new Set();

// WebSocket connection for real-time updates
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  // Identify admin connections
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.type === 'admin') {
      adminClients.add(ws);
      console.log('Admin connected for real-time updates');
    }
  });

  ws.on('close', () => {
    adminClients.delete(ws);
    console.log('WebSocket connection closed');
  });
});

// Function to broadcast new registrations to admins
const broadcastNewRegistration = (userData) => {
  const message = JSON.stringify({
    type: 'NEW_REGISTRATION',
    data: userData,
    timestamp: new Date().toISOString()
  });

  adminClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

// Real-time user registration endpoint
router.post('/register', 
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password, phone, petType } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new user
      const newUser = new User({
        name,
        email,
        password: hashedPassword,
        phone: phone || '',
        petType: petType || 'other',
        createdAt: new Date()
      });

      // Save to database
      await newUser.save();

      // Create JWT token
      const token = jwt.sign(
        { userId: newUser._id, email: newUser.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      // Prepare user data (without password)
      const userResponse = {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        petType: newUser.petType,
        createdAt: newUser.createdAt
      };

      // Broadcast new registration to all connected admins in real-time
      broadcastNewRegistration(userResponse);

      // Send response
      res.status(201).json({
        message: 'User registered successfully!',
        token,
        user: userResponse,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ New user registered: ${email}`);

    } catch (error) {
      console.error('❌ Registration error:', error);
      res.status(500).json({ error: 'Server error during registration' });
    }
  }
);

// Login endpoint
router.post('/login', async (req,res) => {
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      // Create JWT token
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful!',
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          petType: user.petType
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
});

// Get all users (admin only)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json({
      count: users.length,
      users,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get real-time registration stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRegistrations = await User.countDocuments({ createdAt: { $gte: today } });
    
    // Get registrations per hour for the last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hourlyStats = await User.aggregate([
      {
        $match: { createdAt: { $gte: last24Hours } }
      },
      {
        $group: {
          _id: {
            hour: { $hour: "$createdAt" },
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.date": 1, "_id.hour": 1 }
      }
    ]);

    res.json({
      totalUsers,
      todayRegistrations,
      hourlyStats,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Export WebSocket server for use in main server
router.wss = wss;

module.exports = router;