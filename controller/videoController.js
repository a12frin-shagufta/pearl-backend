import express from "express";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import axios from "axios";

const router = express.Router();

// S3 CONFIG FOR BACKBLAZE
const s3 = new S3Client({
  region: "eu-central-003",
  endpoint: process.env.B2_DOWNLOAD_URL, // https://s3.eu-central-003.backblazeb2.com
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
  forcePathStyle: true,
});


export const fetchVideo = async (req, res) => {
  try {
    const filePath = req.params.filePath;

    // 1. Generate S3-style signed URL (valid 1 hour)
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: filePath,
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 3600,
    });

    // console.log("Signed URL:", signedUrl);

    // 2. Stream from signed URL
    const response = await axios({
      url: signedUrl,
      method: "GET",
      responseType: "stream",
    });

    res.setHeader("Content-Type", "video/mp4");
    response.data.pipe(res);

  } catch (err) {
    console.error("Streaming error:", err);
    res.status(500).json({ error: "Failed to stream video", details: err.message });
  }
}