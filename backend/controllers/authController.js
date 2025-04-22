const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');
const { Client } = require('@microsoft/microsoft-graph-client');
const fetch = require('node-fetch');
const bcrypt = require('bcrypt');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Helper function to call Gemini API
const generateGeminiResponse = async (prompt) => {
  try {
    const response = await fetch(`${process.env.GOOGLE_AI_ENDPOINT}?key=${process.env.GOOGLE_AI_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Gemini API error:', error);
    return null;
  }
};

// Register new user
const register = async (req, res) => {
  try {
    console.log('Register request body:', req.body);
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'All fields (username, email, password) are required'
      });
    }

    // Check if username exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        error: 'Username is already taken'
      });
    }

    // Check if email exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email is already registered. Please login'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword
    });

    await newUser.save();

    // Generate token
    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Error during registration. Please try again.'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Please provide email and password' 
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid credentials' 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid credentials' 
      });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error logging in. Please try again.' 
    });
  }
};

// Google OAuth
const googleAuth = async (req, res) => {
  try {
    const { tokenId } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const { email, name, picture: avatar, sub: googleId } = ticket.getPayload();

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        name,
        googleId,
        profile: { avatar }
      });
      await user.save();
    } else if (!user.googleId) {
      user.googleId = googleId;
      if (!user.profile.avatar) user.profile.avatar = avatar;
      await user.save();
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error with Google authentication' });
  }
};

// Microsoft OAuth
const microsoftAuth = async (req, res) => {
  try {
    const { accessToken } = req.body;

    const client = Client.init({
      authProvider: (done) => done(null, accessToken)
    });

    const userInfo = await client.api('/me').get();
    const { mail: email, displayName: name, id: microsoftId } = userInfo;

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        name,
        microsoftId
      });
      await user.save();
    } else if (!user.microsoftId) {
      user.microsoftId = microsoftId;
      await user.save();
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error with Microsoft authentication' });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    const allowedUpdates = ['name', 'profile', 'preferences'];
    const user = req.user;

    // Filter out non-allowed updates
    Object.keys(updates).forEach((key) => {
      if (!allowedUpdates.includes(key)) delete updates[key];
    });

    // Update user
    Object.assign(user, updates);
    await user.save();

    res.json({
      success: true,
      user: user.getPublicProfile()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error updating profile' });
  }
};

// Complete onboarding
const completeOnboarding = async (req, res) => {
  try {
    const { goals, interests, subjects, class: className } = req.body;
    const user = req.user;

    // Use Gemini to analyze goals and provide personalized feedback
    if (goals && goals.length > 0 && process.env.GOOGLE_AI_KEY) {
      try {
        const prompt = `As an educational AI assistant, analyze these learning goals and provide brief, encouraging feedback: ${goals.join(', ')}`;
        const feedback = await generateGeminiResponse(prompt);
        if (feedback) {
          user.profile.aiFeedback = feedback;
        }
      } catch (error) {
        console.error('Gemini API error:', error);
      }
    }

    // Update user profile
    user.profile.goals = goals || user.profile.goals;
    user.profile.interests = interests || user.profile.interests;
    user.profile.subjects = subjects || user.profile.subjects;
    user.profile.class = className || user.profile.class;
    user.onboardingCompleted = true;

    await user.save();

    res.json({
      success: true,
      user: user.getPublicProfile()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error completing onboarding' });
  }
};

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user.getPublicProfile()
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching user data' 
    });
  }
};

module.exports = {
  register,
  login,
  googleAuth,
  microsoftAuth,
  updateProfile,
  completeOnboarding,
  getCurrentUser
}; 