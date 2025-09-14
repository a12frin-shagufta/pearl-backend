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
// ---------- CORS setup (replace existing block) ----------
const rawAllowed = process.env.ALLOWED_ORIGINS || "";
const allowedOrigins = rawAllowed
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// helpful startup log
console.log("CORS allowed origins:", allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    console.log("CORS check for:", origin);
    // allow requests with no origin (server-to-server, curl, mobile)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","Accept","Origin"]
};

// use the middleware and explicitly handle preflight
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
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
