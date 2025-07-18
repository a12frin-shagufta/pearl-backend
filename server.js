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
import orderRouter from './routes/orderRoute.js';

const app = express();
const port = process.env.PORT || 4000;

// ✅ Setup allowed origins from .env
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

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
app.use('/api/order',orderRouter)

// ✅ Test route
app.get('/', (req, res) => {
  res.send('API Working');
});

// ✅ Start server
app.listen(port, () => {
  console.log(`Server started on port: ${port}`);
});
