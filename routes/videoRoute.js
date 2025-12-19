import express from "express";
import {getVideoUrl, getVideoWithProxy, streamVideo} from "../controller/videoController.js";

const router = express.Router();


// Get signed URL for video (recommended for iOS)
router.get("/url", getVideoUrl);

// Stream video through server (fallback)
router.get("/stream", streamVideo);

// Get video URL with proxy option
router.get("/get", getVideoWithProxy);

export default router;
