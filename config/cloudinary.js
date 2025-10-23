// /var/www/pleasantpearl/config/cloudinary.js
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,        // dpp74uypv
  api_key:    process.env.CLOUDINARY_API_KEY,     // 178635946195658
  api_secret: process.env.CLOUDINARY_SECRET_KEY,  // LSn560HaaPWBAahjXwp-UbeJQ5o
  secure: true,
});

// quick sanity log at boot (one-time)
console.log("[cloudinary] init ok:",
  { name: process.env.CLOUDINARY_NAME, hasUploader: !!cloudinary.uploader });
  const c = mongoose.connection;
console.log("[DB INFO]", { host: c.host, name: c.name, readyState: c.readyState });


export default cloudinary;
