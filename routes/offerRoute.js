import express from "express";
import { createOffer, getActiveOffers , deleteOffer } from "../controller/offerController.js";
import verifyAdminToken from "../middleware/verifyAdminToken.js";

const offerRouter = express.Router();

offerRouter.post("/add", verifyAdminToken, createOffer);
offerRouter.get("/active", getActiveOffers);
offerRouter.delete("/delete/:id", verifyAdminToken, deleteOffer);

export default offerRouter;
