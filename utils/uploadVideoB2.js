// utils/uploadVideoB2.js - FIXED VERSION
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "eu-central-003",
  endpoint: process.env.B2_DOWNLOAD_URL,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
  forcePathStyle: true,
});

// Upload and return just the key
export const uploadToB2 = async (filePath, fileName, mimeType, fs) => {
  const fileBuffer = fs.readFileSync(filePath);
  const uploadPath = `${Date.now()}-${fileName.replace(/\s+/g, '-')}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: uploadPath,
      Body: fileBuffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000',
      Metadata: {
        'content-disposition': 'inline'
      }
    })
  );

  return uploadPath; // Return just the key
};

// ✅ FIXED: Generate signed URL (REMOVE HeadObjectCommand)
export const getSignedVideoUrl = async (key, expiresIn = 7200) => {
  try {
    // Check if it's a Cloudinary URL (old format)
    if (key && key.includes('cloudinary.com')) {
      return key; // Return the Cloudinary URL as-is for old videos
    }
    
    // Check if it's already a signed URL
    if (key && (key.includes('X-Amz-Signature') || key.includes('X-Amz-Credential'))) {
      return key;
    }
    
    // It's a B2 key - generate signed URL
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
      ResponseCacheControl: 'public, max-age=31536000',
      ResponseContentDisposition: 'inline',
    });
    
    const signedUrl = await getSignedUrl(s3, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error("Error generating signed URL for key:", key, error.message);
    // If it's a Cloudinary URL, return it as fallback
    if (key && key.includes('cloudinary.com')) {
      return key;
    }
    throw error;
  }
};