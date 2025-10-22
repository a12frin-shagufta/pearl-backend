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
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 5002;


const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Define allowed offrigins
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5175',
  'http://localhost:5174',
  'https://pearl-admin-blush.vercel.app',
  'https://peasent-pearl.vercel.app',
];

// Middleware to log undefined origins
app.use((req, res, next) => {
  if (!req.headers.origin) {
    console.warn('Request with undefined origin:', {
      url: req.url,
      method: req.method,
      headers: req.headers,
    });
  }
  next();
});

// CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      console.log('CORS check for:', origin);
      // Allow requests with no origin (e.g., Postman, server-side scripts)
      if (!origin) {
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use('/api/order', orderRouter);

// Test route
app.get('/', (req, res) => {
  res.send('API Working');
});

// Start server
app.listen(port, () => {
  console.log(`Server started on port: ${port}`);
});