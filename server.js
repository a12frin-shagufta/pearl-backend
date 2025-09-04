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


const app = express();
const port = process.env.PORT || 5000;

// ✅ Setup allowed origins from .env
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim()); // trim just in case

app.use(cors({
  origin(origin, cb) {
    console.log("CORS check for:", origin);
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","PATCH","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));

// respond to preflight fast
app.options("*", cors());

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


// ✅ Test route
app.get('/', (req, res) => {
  res.send('API Working');
});

// ✅ Start server
app.listen(port, () => {
  console.log(`Server started on port: ${port}`);
});
