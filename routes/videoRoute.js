import express from "express";
import {fetchVideo} from "../controller/videoController.js";

const router = express.Router();


router.get("/:filePath(*)", fetchVideo );

export default router;
