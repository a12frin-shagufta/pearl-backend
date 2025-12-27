import multer from "multer";

const storage = multer.memoryStorage(); 

export const uploadVideo = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, 
}).single("video");

export const uploadImages = multer({ 
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB (safe)
  }
 }).fields([
  { name: "variantImage0", maxCount: 1 },
  { name: "variantImage1", maxCount: 1 },
  { name: "variantImage2", maxCount: 1 },
  { name: "avatar", maxCount: 1 }
]); 
