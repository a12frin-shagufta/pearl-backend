// server.js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDb from './config/mongodb.js';
import connectCloudinary from './config/cloudinary.js';
import adminRouter from './routes/adminRoute.js';
import offerRouter from './routes/offerRoute.js';
import productRouter from './routes/productRoute.js';
import contactRouter from './routes/contactRoute.js';
import categoryRouter from './routes/categoryRoute.js';
import testimonialRouter from './routes/testimonialRoute.js';
import orderRouter from './routes/orderRoute.js';
import path from 'path';

const app = express();
const port = process.env.PORT || 5000;

// Define allowed origins (combine .env and dynamic Vercel preview URLs)
const allowedOrigins = [
  ...(process.env.ALLOWED_ORIGINS?.split(',') || []),
  'http://localhost:5176', // Add missing local origin
];

// CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      console.log('CORS check for:', origin);
      // Allow requests with no origin (e.g., Postman, server-side scripts)
      if (!origin) {
        console.warn('Request with undefined origin:', {
          url: req.url,
          method: req.method,
          headers: req.headers,
        });
        return callback(null, true);
      }
      // Allow listed origins or Vercel preview URLs
      if (
        allowedOrigins.includes(origin) ||
        /^https:\/\/peasent-pearl-.*\.vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Ensure OPTIONS is included for preflight
    allowedHeaders: ['Content-Type', 'Authorization'], // Match headers in your requests
    credentials: true, // Support cookies/auth tokens
  })
);

// Body parser
app.use(express.json());

// Connect services
connectDb();
connectCloudinary();

// Routes
app.use('/api/user', adminRouter);
app.use('/api/offer', offerRouter);
app.use('/api/product', productRouter);
app.use('/api/contact', contactRouter);
app.use('/api/category', categoryRouter);
app.use('/api/testimonials', testimonialRouter);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/order', orderRouter);

// Test route
app.get('/', (req, res) => {
  res.send('API Working');
});

// Start server
app.listen(port, () => {
  console.log(`Server started on port: ${port}`);
});