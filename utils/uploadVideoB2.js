// utils/uploadVideoB2.js - UPDATED WITH DEBUG LOGS
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { configDotenv } from "dotenv";
configDotenv()

const getS3Client = () => {
  // 🎯 DEBUG: Log YOUR ACTUAL environment variables
  console.log('🔧 B2 Environment Check:', {
    B2_KEY_ID: process.env.B2_KEY_ID ? 'SET' : 'MISSING',
    B2_APPLICATION_KEY: process.env.B2_APPLICATION_KEY ? 'SET' : 'MISSING',
    B2_BUCKET_NAME: process.env.B2_BUCKET_NAME ? 'SET' : 'MISSING',
    B2_DOWNLOAD_URL: process.env.B2_DOWNLOAD_URL ? 'SET' : 'MISSING',
    B2_BUCKET_ID: process.env.B2_BUCKET_ID ? 'SET' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV || 'undefined'
  });
  
  // Use YOUR actual environment variable names
  const accessKeyId = process.env.B2_KEY_ID; // ← This is your variable name
  const secretAccessKey = process.env.B2_APPLICATION_KEY;
  const endpoint = process.env.B2_DOWNLOAD_URL || 'https://s3.eu-central-003.backblazeb2.com';
  
  console.log(`🔗 Using endpoint: ${endpoint}`);
  console.log(`🔑 Using keyId: ${accessKeyId}`);
  console.log(`🔑 Key length: ${accessKeyId?.length || 0} chars`);
  
  if (!accessKeyId || !secretAccessKey) {
    console.error('❌ B2 credentials are MISSING!');
    console.error('❌ B2_KEY_ID:', accessKeyId ? 'Exists' : 'Missing');
    console.error('❌ B2_APPLICATION_KEY:', secretAccessKey ? 'Exists' : 'Missing');
    throw new Error('B2 credentials not configured');
  }
  
  return new S3Client({
    region: "eu-central-003",
    endpoint: endpoint,
    credentials: {
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
    },
    forcePathStyle: true,
  });
};

// Upload and return just the key

export const uploadToB2 = async (fileBuffer, fileName, mimeType) => {
  // ✅ REMOVED: fs parameter
  console.log(`📤 uploadToB2 from BUFFER: ${fileName} (${fileBuffer.length} bytes)`);
  
  try {
    const s3 = getS3Client();
    const uploadPath = `${Date.now()}-${fileName.replace(/\s+/g, '-')}`;
    
    console.log(`📦 Uploading buffer to B2: ${uploadPath}`);
    
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: uploadPath,
        Body: fileBuffer, // ← Direct buffer, no file reading!
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000',
        Metadata: {
          'content-disposition': 'inline'
        }
      })
    );
    
    console.log(`✅ uploadToB2 SUCCESS from buffer: ${uploadPath}`);
    return uploadPath;
    
  } catch (error) {
    console.error(`🔥 uploadToB2 FAILED:`, error.message);
    console.error('🔥 Error details:', error);
    throw error;
  }
};

// Generate signed URL
export const getSignedVideoUrl = async (key, expiresIn = 7 * 24 * 3600) => {
  console.log(`🔗 getSignedVideoUrl CALLED for: "${key?.substring(0, 50)}..."`);
  
  // Backblaze B2 maximum: 7 days (604800 seconds)
  const MAX_EXPIRY = 7 * 24 * 3600; // 604800 seconds
  const actualExpiry = Math.min(expiresIn, MAX_EXPIRY);
  
  console.log(`⏱️ Expiry: Requested ${expiresIn}s, Using ${actualExpiry}s (${Math.round(actualExpiry/3600)}h)`);
  
  // Validate key first
  if (!key || typeof key !== 'string') {
    throw new Error(`Invalid video key: ${typeof key} (${key})`);
  }
  
  if (key.includes('cloudinary.com')) {
    throw new Error(`Cloudinary URL passed as video key: ${key.substring(0, 50)}...`);
  }
  
  try {
    // Check if it's already a signed URL (contains AWS signature)
    if (key.includes('X-Amz-Signature') || key.includes('X-Amz-Credential') || key.includes('?X-Amz-')) {
      console.log('🔐 Key is already a signed URL, checking expiry...');
      
      // Parse the existing URL to check its expiry
      try {
        const url = new URL(key);
        const params = new URLSearchParams(url.search);
        const expiresParam = params.get('X-Amz-Expires');
        
        if (expiresParam) {
          const remainingSeconds = parseInt(expiresParam);
          console.log(`📊 Existing URL has ${remainingSeconds}s (${Math.round(remainingSeconds/3600)}h) remaining`);
          
          // If less than 24h left, generate new one
          if (remainingSeconds < (24 * 3600)) {
            console.log('🔄 Existing URL expires soon, generating fresh 7-day URL');
            // Extract the actual key from URL path
            const pathParts = url.pathname.split('/');
            const actualKey = pathParts[pathParts.length - 1];
            return await generateFreshSignedUrl(actualKey, actualExpiry);
          }
        }
      } catch (parseErr) {
        console.warn('⚠️ Could not parse existing URL, generating fresh one');
      }
      return key; // Return existing if still valid
    }
    
    // Generate fresh signed URL
    console.log(`🔑 Generating ${Math.round(actualExpiry/3600)}h URL for: ${key.substring(0, 30)}...`);
    
    const s3 = getS3Client();
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
      ResponseCacheControl: 'public, max-age=31536000',
      ResponseContentDisposition: 'inline',
    });
    
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: actualExpiry });
    
    console.log(`✅ Generated ${Math.round(actualExpiry/3600)}h URL (${signedUrl.length} chars)`);
    console.log(`🔗 Preview: ${signedUrl.substring(0, 80)}...`);
    
    return signedUrl;
    
  } catch (error) {
    console.error(`🔥 getSignedVideoUrl FAILED for "${key}":`, error.message);
    console.error('🔥 Error stack:', error.stack);
    throw error;
  }
};

// Helper function for fresh URL generation
const generateFreshSignedUrl = async (key, expiresIn) => {
  const s3 = getS3Client();
  const command = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME,
    Key: key,
    ResponseCacheControl: 'public, max-age=31536000',
    ResponseContentDisposition: 'inline',
  });
  
  return await getSignedUrl(s3, command, { expiresIn });
};