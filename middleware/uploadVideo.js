import multer from "multer";

const storage = multer.memoryStorage(); 

export const uploadVideo = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, 
}).single("video");
