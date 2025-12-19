import express from "express";
import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const router = express.Router();

// S3 CONFIG FOR BACKBLAZE
const s3 = new S3Client({
  region: "eu-central-003",
  endpoint: process.env.B2_DOWNLOAD_URL,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
  forcePathStyle: true,
});

// ✅ NEW: Generate iOS-compatible signed URL
const getVideoUrl = async (req, res) => {
  try {
    const { key } = req.query;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Video key is required"
      });
    }

    // 1. First get file metadata to know content type
    const headCommand = new HeadObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key
    });

    let metadata;
    try {
      metadata = await s3.send(headCommand);
    } catch (headErr) {
      console.error("Error getting file metadata:", headErr);
      return res.status(404).json({
        success: false,
        message: "Video not found"
      });
    }

    // 2. Create signed URL with iOS-specific parameters
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
      // ⚠️ CRITICAL: Set response headers for iOS
      ResponseContentType: metadata.ContentType || 'video/mp4',
      ResponseCacheControl: 'public, max-age=31536000, immutable',
      ResponseContentDisposition: 'inline', // Don't force download
    });

    // 3. Generate signed URL (valid for 2 hours)
    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 7200, // 2 hours
    });

    // 4. Return the signed URL - let iOS fetch directly
    res.json({
      success: true,
      url: signedUrl,
      expiresIn: 7200,
      contentType: metadata.ContentType,
      contentLength: metadata.ContentLength
    });

  } catch (error) {
    console.error("Error generating video URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate video URL",
      error: error.message
    });
  }
};

// ✅ Keep your existing streaming endpoint as fallback
const streamVideo = async (req, res) => {
  try {
    const { key } = req.query;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Video key is required"
      });
    }

    // Generate signed URL
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 3600,
    });

    // Stream video through server (fallback for problematic browsers)
    const response = await fetch(signedUrl);
    
    // Copy headers from B2 response
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // ⚠️ CRITICAL: Add iOS required headers
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Ensure content type
    if (!res.hasHeader('Content-Type')) {
      res.setHeader('Content-Type', 'video/mp4');
    }

    // Stream the video
    response.body.pipe(res);

  } catch (err) {
    console.error("Streaming error:", err);
    res.status(500).json({ 
      error: "Failed to stream video", 
      details: err.message 
    });
  }
};

// ✅ NEW: Pre-signed URL with CORS proxy option
const getVideoWithProxy = async (req, res) => {
  try {
    const { key } = req.query;
    const useProxy = req.query.proxy === 'true';
    
    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Video key is required"
      });
    }

    // Generate signed URL
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
      ResponseCacheControl: 'public, max-age=31536000',
      ResponseContentDisposition: 'inline',
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 7200,
    });

    if (useProxy) {
      // Return a proxy URL for iOS
      const proxyUrl = `${req.protocol}://${req.get('host')}/api/video/stream?key=${encodeURIComponent(key)}`;
      res.json({
        success: true,
        url: proxyUrl,
        type: 'proxy',
        expiresIn: 7200
      });
    } else {
      // Return direct signed URL
      res.json({
        success: true,
        url: signedUrl,
        type: 'direct',
        expiresIn: 7200
      });
    }

  } catch (error) {
    console.error("Error getting video URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get video URL"
    });
  }
};

export {getVideoUrl, streamVideo, getVideoWithProxy }