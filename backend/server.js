const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { generateQuiz } = require('./controllers/quizController');
const { exportToPDF, exportToGoogleForms, exportToMoodle } = require('./controllers/exportController');
const { upload, uploadPDF } = require('./controllers/pdfController');

// Import routes
const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');

// Load environment variables
dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
  origin: '*', // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Check if server is up
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Server is healthy' });
});

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Request body:', JSON.stringify(req.body).substring(0, 200) + '...');
  }
  next();
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.post('/api/generate-quiz', generateQuiz);
app.post('/api/export/pdf', exportToPDF);
app.post('/api/export/google-forms', exportToGoogleForms);
app.post('/api/export/moodle', exportToMoodle);
app.post('/api/upload-pdf', upload.single('pdf'), uploadPDF);

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!', success: true });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error occurred:', err);
  console.error(err.stack);
  res.status(err.status || 500).json({ 
    success: false,
    message: err.message || 'Something went wrong!', 
    error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message 
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Set up server port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 