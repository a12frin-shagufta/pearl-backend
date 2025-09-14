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


const app = express();
const port = process.env.PORT || 5000;

// ✅ Setup allowed origins from .env
// ---------- CORS setup (env list + safe Vercel preview patterns) ----------
const rawAllowed = process.env.ALLOWED_ORIGINS || "";
const allowedOrigins = rawAllowed.split(",").map(s => s.trim()).filter(Boolean);
console.log("CORS allowed origins (env):", allowedOrigins);

// allow common Vercel preview patterns for those two prefixes
const allowedHostPatterns = [
  /^https:\/\/peasent-pearl(-.*)?\.vercel\.app$/,
  /^https:\/\/pearl-admin-blush(-.*)?\.vercel\.app$/
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log("CORS check for:", origin);
    if (!origin) return callback(null, true); // server-to-server/curl
    if (allowedOrigins.includes(origin)) return callback(null, true);
    for (const re of allowedHostPatterns) {
      if (re.test(origin)) return callback(null, true);
    }
    console.warn("CORS blocked origin:", origin);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","Accept","Origin"]
};

app.use(require("cors")(corsOptions));
app.options("*", require("cors")(corsOptions));
// ---------------------------------------------------------



// ✅ Body parser
app.use(express.json());

// ✅ Connect services
connectDb();
connectCloudinary();

// ✅ Routes
app.use('/api/user', adminRouter);
app.use('/api/offer', offerRouter);
app.use('/api/product', productRouter);
app.use('/api/contact', contactRouter);
app.use('/api/category', categoryRouter);
app.use('/api/testimonials', testimonialRouter);


// ✅ Test route
app.get('/', (req, res) => {
  res.send('API Working');
});

// ✅ Start server
app.listen(port, () => {
  console.log(`Server started on port: ${port}`);
});
