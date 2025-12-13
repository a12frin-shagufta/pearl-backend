import Admin from "../models/adminModel.js"
import jwt from 'jsonwebtoken'

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and password are required" 
      });
    }

    if (
      email !== process.env.ADMIN_EMAIL || 
      password !== process.env.ADMIN_PASSWORD
    ) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid admin credentials" 
      });
    }

    const token = jwt.sign(
      { email, isAdmin: true }, 
      process.env.JWT_SECRET, 
      { expiresIn: "365d" }
    );

    res.status(200).json({
      success: true,
      token,
      isAdmin: true,
      message: "Admin login successful"
    });

  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Admin login failed" 
    });
  }
};

export {adminLogin}