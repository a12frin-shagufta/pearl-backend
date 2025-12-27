// server.js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDb from './config/mongodb.js';
import adminRouter from './routes/adminRoute.js';
import offerRouter from './routes/offerRoute.js';
import productRouter from './routes/productRoute.js';
import contactRouter from './routes/contactRoute.js';
import categoryRouter from './routes/categoryRoute.js';
import testimonialRouter from './routes/testimonialRoute.js';
import orderRouter from './routes/orderRoute.js';
import path from 'path';
import { fileURLToPath } from "url";
import videoRouter from "./routes/videoRoute.js"
const app = express();
const port = process.env.PORT || 3000;
import mongoose from 'mongoose';
import imagekit from './config/imageKit.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Define allowed offrigins
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5175',
  'http://localhost:5174',
  'https://pearl-admin-blush.vercel.app',
  'https://peasent-pearl.vercel.app',
  'http://localhost:3000',            
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
// app.use(
//   cors({
//     origin: function (origin, callback) {
//       console.log('CORS check for:', origin);
//       // Allow requests with no origin (e.g., Postman, server-side scripts)
//       if (!origin) {
//         return callback(null, true);
//       }
//       // Allow listed origins or Vercel preview URLs
// if (
//   allowedOrigins.includes(origin) ||
//   /^https:\/\/peasent-pearl-.*\.vercel\.app$/.test(origin) ||
//   /^https:\/\/pearl-admin-.*\.vercel\.app$/.test(origin)  // ← ADD THIS LINE
// ) {
//   return callback(null, true);
// } {
//         return callback(null, true);
//       }
//       return callback(new Error(`Not allowed by CORS: ${origin}`));
//     },
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
//     credentials: true,
//   })
// );
app.use(
  cors({
    origin: function (origin, callback) {
      console.log('CORS check for:', origin);

      // Allow requests with no origin (Postman, server-side)
      if (!origin) return callback(null, true);

      // Check allowed origins
      if (
        allowedOrigins.includes(origin) ||
        /^https:\/\/peasent-pearl-.*\.vercel\.app$/.test(origin) ||
        /^https:\/\/pearl-admin-.*\.vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }

      // Otherwise block
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);


app.options('*', cors());

// Body parser
app.use(express.json({ limit: '200mb' }));
// app.use(express.urlencoded({ limit: '200mb', extended: true }));

// Connect services
connectDb()
  .then(() => {
    // const c = mongoose.connection;
    // console.log("[DB INFO]", { host: c.host, name: c.name, readyState: c.readyState });
    // console.log("[cloudinary] init ok (server.js):", {
    //   name: process.env.CLOUDINARY_CLOUD_NAME,
    //   hasUploader: !!cloudinary.uploader,
    // });
    const c = mongoose.connection;
    console.log("[DB INFO]", { host: c.host, name: c.name, readyState: c.readyState });
    console.log("[ImageKit] init ok (server.js):", {
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      hasUploader: !!imagekit.upload, // ImageKit has .upload method
    });
    // Routes
    app.use("/api/user", adminRouter);
    app.use("/api/offer", offerRouter);
    app.use("/api/product", productRouter);
    app.use("/api/contact", contactRouter);
    app.use("/api/category", categoryRouter);
    app.use("/api/testimonials", testimonialRouter);
    app.use("/uploads", express.static(path.join(__dirname, "uploads")));
    app.use("/api/order", orderRouter);
    app.use("/api/video", videoRouter)

    app.get("/", (_, res) => res.send("API Working"));

    app.listen(port, () => console.log(`Server started on port: ${port}`));
  })
  .catch((err) => {
    console.error("DB connect failed:", err);
    process.exit(1);
  });