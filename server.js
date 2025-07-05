import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectDb from './config/mongodb.js';
import connectCloudinary from './config/cloudinary.js';
import adminRouter from './routes/adminRoute.js';
import offerRouter from './routes/offerRoute.js';
import productRouter from './routes/productRoute.js';
import contactRouter from './routes/contactRoute.js'
import categoryRouter from './routes/categoryRoute.js';


// App config
const app = express();
const port = process.env.PORT || 4000

// middlewares

app.use(express.json());
app.use(cors());
connectDb();
connectCloudinary();

// Api end points

app.use('/api/user',adminRouter)
app.use('/api/offer',offerRouter)
app.use('/api/product', productRouter);
app.use('/api/contact',contactRouter)
app.use("/api/category", categoryRouter);



app.get('/',(req,res) => {
res.send("API Working")
})

app.listen(port,() => {
    console.log("server started on port : 4000")
})