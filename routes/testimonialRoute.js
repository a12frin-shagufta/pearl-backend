// import express from "express";
// import multer from "multer";
// import {
//   getPublicTestimonials,
//   getAllTestimonials,
//   createTestimonial,
//   updateTestimonial,
//   toggleStatus,
//   reorder,
//   remove,
// } from "../controller/testimonialController.js";

// // ⚠️ Use your existing admin auth middleware here:
// import verifyAdminToken from "../middleware/verifyAdminToken.js";

// const testimonialRouter = express.Router();

// // Multer (memory or disk). Here disk temp is fine; Cloudinary reads the file path.
// const storage = multer.diskStorage({});
// const upload = multer({ storage });

// // Public
// testimonialRouter.get("/", getPublicTestimonials);

// // Admin
// testimonialRouter.get("/all", verifyAdminToken, getAllTestimonials);
// testimonialRouter.post(
//   "/",
//   verifyAdminToken,
//   upload.fields([{ name: "avatar", maxCount: 1 }, { name: "media", maxCount: 6 }]),
//   createTestimonial
// );
// testimonialRouter.put(
//   "/:id",
//   verifyAdminToken,
//   upload.fields([{ name: "avatar", maxCount: 1 }, { name: "media", maxCount: 6 }]),
//   updateTestimonial
// );
// testimonialRouter.patch("/:id/status", verifyAdminToken, toggleStatus);
// testimonialRouter.patch("/reorder", verifyAdminToken, reorder);
// testimonialRouter.delete("/:id", verifyAdminToken, remove);

// export default testimonialRouter;


import express from "express";
import multer from "multer";
import {
  getPublicTestimonials,
  getAllTestimonials,
  createTestimonial,
  updateTestimonial,
  toggleStatus,
  reorder,
  remove,
} from "../controller/testimonialController.js";

// ⚠️ Admin auth middleware
import verifyAdminToken from "../middleware/verifyAdminToken.js";

const testimonialRouter = express.Router();

// --- Multer: memoryStorage for ImageKit ---
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- Public Routes ---
testimonialRouter.get("/", getPublicTestimonials);

// --- Admin Routes ---
testimonialRouter.get("/all", verifyAdminToken, getAllTestimonials);

testimonialRouter.post(
  "/",
  verifyAdminToken,
  upload.fields([{ name: "avatar", maxCount: 1 }, { name: "media", maxCount: 6 }]),
  createTestimonial
);

testimonialRouter.put(
  "/:id",
  verifyAdminToken,
  upload.fields([{ name: "avatar", maxCount: 1 }, { name: "media", maxCount: 6 }]),
  updateTestimonial
);

testimonialRouter.patch("/:id/status", verifyAdminToken, toggleStatus);
testimonialRouter.patch("/reorder", verifyAdminToken, reorder);
testimonialRouter.delete("/:id", verifyAdminToken, remove);

export default testimonialRouter;

