import express from 'express';
import { adminLogin } from '../controller/adminController.js';
import verifyAdminToken from '../middleware/verifyAdminToken.js';

const adminRouter = express.Router();

// Admin login route (public)
adminRouter.post('/admin', adminLogin);

// Example protected route (only accessible if valid admin token is present)
adminRouter.get('/admin/dashboard', verifyAdminToken, (req, res) => {
  res.json({ success: true, message: "Welcome, Admin 👑" });
});

export default adminRouter;
