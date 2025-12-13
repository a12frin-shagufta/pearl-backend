import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "eu-central-003",
  endpoint: process.env.B2_DOWNLOAD_URL,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY,
  },
  forcePathStyle: true,
});

export const uploadToB2 = async (filePath, fileName, mimeType, fs) => {
  const fileBuffer = fs.readFileSync(filePath);

  // store however you want. no prefix needed.
  const uploadPath = `${Date.now()}-${fileName}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: uploadPath,
      Body: fileBuffer,
      ContentType: mimeType,
    })
  );

  return uploadPath; // THIS is what goes into MongoDB
};
