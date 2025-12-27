import ImageKit from "imagekit";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Try to list files to verify account
imagekit.listFiles({}, function(error, result) {
  if(error) {
    console.log("ImageKit connection failed:", error.message);
  } else {
    console.log("✅ ImageKit connected successfully!");
    console.log("Total files in account:", result.length);
  }
});

export default imagekit;
