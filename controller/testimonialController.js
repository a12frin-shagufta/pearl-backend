import cloudinary from "cloudinary";
import Testimonial from "../models/testimonialModel.js";

// Helpers
const parseJSON = (val, fallback) => {
  try { return val ? JSON.parse(val) : fallback; } catch { return fallback; }
};

// Public GET (published only by default)
export const getPublicTestimonials = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      lang = "",
      productId = "",
      featuredFirst = "true",
      published = "true",
    } = req.query;

    const query = {};
    if (published === "true") query.published = true;
    if (lang) query.language = lang;
    if (productId) query.productId = productId;

    const skip = (Number(page) - 1) * Number(limit);

    // Sort: featured first (desc), then sortOrder asc, then date desc
    const sort = {
      ...(featuredFirst === "true" ? { featured: -1 } : {}),
      sortOrder: 1,
      createdAt: -1,
    };

    const [data, total] = await Promise.all([
      Testimonial.find(query).sort(sort).skip(skip).limit(Number(limit)),
      Testimonial.countDocuments(query),
    ]);

    res.json({ data, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) {
    console.error("getPublicTestimonials error:", err);
    res.status(500).json({ message: "Failed to fetch testimonials" });
  }
};

// Admin list (all)
export const getAllTestimonials = async (req, res) => {
  try {
    const data = await Testimonial.find({}).sort({ featured: -1, sortOrder: 1, createdAt: -1 });
    res.json({ data });
  } catch (err) {
    console.error("getAllTestimonials error:", err);
    res.status(500).json({ message: "Failed to fetch testimonials" });
  }
};

export const createTestimonial = async (req, res) => {
  try {
    const {
      customerName,
      headline,
      content,
      rating,
      productId,
      productName,
      location,
      language,
      featured,
      sortOrder,
      published,
      mediaMeta, // optional alt/type overrides as JSON array matching uploads order
    } = req.body;

    if (!customerName || !content) {
      return res.status(400).json({ message: "customerName and content are required" });
    }

    const files = req.files || {};
    const uploads = [];

    // Avatar (single)
    let avatarUrl = "";
    if (files.avatar?.[0]) {
      const up = await cloudinary.v2.uploader.upload(files.avatar[0].path, { folder: "testimonials" });
      avatarUrl = up.secure_url;
    }

    // Media (multiple)
    const mediaMetaArr = parseJSON(mediaMeta, []);
    if (files.media?.length) {
      for (let i = 0; i < files.media.length; i++) {
        const file = files.media[i];
        const up = await cloudinary.v2.uploader.upload(file.path, { folder: "testimonials" });
        const meta = mediaMetaArr[i] || {};
        uploads.push({
          type: meta.type || (file.mimetype.startsWith("video") ? "video" : "image"),
          url: up.secure_url,
          alt: meta.alt || "",
        });
      }
    }

    const doc = await Testimonial.create({
      customerName,
      headline,
      content,
      rating: rating ? Number(rating) : undefined,
      avatarUrl,
      media: uploads,
      productId: productId || undefined,
      productName,
      location,
      language: language || "en",
      featured: featured === "true" || featured === true,
      sortOrder: sortOrder ? Number(sortOrder) : 0,
      published: published === "true" || published === true,
      publishedAt: (published === "true" || published === true) ? new Date() : undefined,
    });

    res.status(201).json({ message: "Created", data: doc });
  } catch (err) {
    console.error("createTestimonial error:", err);
    res.status(500).json({ message: "Failed to create testimonial" });
  }
};

export const updateTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const update = {
      customerName: body.customerName,
      headline: body.headline,
      content: body.content,
      rating: body.rating ? Number(body.rating) : undefined,
      productId: body.productId || undefined,
      productName: body.productName,
      location: body.location,
      language: body.language,
      featured: body.featured === "true" || body.featured === true,
      sortOrder: body.sortOrder ? Number(body.sortOrder) : 0,
    };

    // Avatar replace
    if (req.files?.avatar?.[0]) {
      const up = await cloudinary.v2.uploader.upload(req.files.avatar[0].path, { folder: "testimonials" });
      update.avatarUrl = up.secure_url;
    }

    // Media append (optional)
    const newMedia = [];
    if (req.files?.media?.length) {
      const mediaMetaArr = parseJSON(body.mediaMeta, []);
      for (let i = 0; i < req.files.media.length; i++) {
        const f = req.files.media[i];
        const up = await cloudinary.v2.uploader.upload(f.path, { folder: "testimonials" });
        const meta = mediaMetaArr[i] || {};
        newMedia.push({
          type: meta.type || (f.mimetype.startsWith("video") ? "video" : "image"),
          url: up.secure_url,
          alt: meta.alt || "",
        });
      }
    }

    if (body.keepMedia) {
      // keepMedia should be the full media array JSON you want to keep
      update.media = parseJSON(body.keepMedia, []);
    }
    if (newMedia.length) {
      update.media = [...(update.media || parseJSON(body.keepMedia, [])), ...newMedia];
    }

    const doc = await Testimonial.findByIdAndUpdate(id, update, { new: true });
    res.json({ message: "Updated", data: doc });
  } catch (err) {
    console.error("updateTestimonial error:", err);
    res.status(500).json({ message: "Failed to update testimonial" });
  }
};

export const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const patch = {};
    if (typeof req.body.published !== "undefined") {
      patch.published = req.body.published === "true" || req.body.published === true;
      patch.publishedAt = patch.published ? new Date() : undefined;
    }
    if (typeof req.body.featured !== "undefined") {
      patch.featured = req.body.featured === "true" || req.body.featured === true;
    }
    const doc = await Testimonial.findByIdAndUpdate(id, patch, { new: true });
    res.json({ message: "Status updated", data: doc });
  } catch (err) {
    console.error("toggleStatus error:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
};

export const reorder = async (req, res) => {
  try {
    const { items } = req.body; // [{id, sortOrder}]
    if (!Array.isArray(items)) return res.status(400).json({ message: "items must be an array" });
    const ops = items.map(it => ({
      updateOne: {
        filter: { _id: it.id },
        update: { $set: { sortOrder: Number(it.sortOrder) || 0 } }
      }
    }));
    if (ops.length) await Testimonial.bulkWrite(ops);
    res.json({ message: "Reordered" });
  } catch (err) {
    console.error("reorder error:", err);
    res.status(500).json({ message: "Failed to reorder" });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    await Testimonial.findByIdAndDelete(id);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("remove error:", err);
    res.status(500).json({ message: "Failed to delete testimonial" });
  }
};
