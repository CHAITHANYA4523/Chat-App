import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No Token Provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized - Invalid Token" });
    }

    const user = await User.findById(decoded.userId).select("-password");
    
    if (!user) {
      return res.status(401).json({ message: "User Not Found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log("Error in protectRoute middleware:", error.message);
    
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: "Unauthorized - Token Expired",
        error: "TOKEN_EXPIRED"
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: "Unauthorized - Invalid Token",
        error: "INVALID_TOKEN"
      });
    }
    
    if (error.name === 'NotBeforeError') {
      return res.status(401).json({ 
        message: "Unauthorized - Token Not Active",
        error: "TOKEN_NOT_ACTIVE"
      });
    }
    
    res.status(500).json({ message: "Internal server error" });
  }
};

// Middleware to refresh token if it's about to expire
export const refreshTokenIfNeeded = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentTime = Date.now() / 1000;
    
    // If token expires in less than 1 hour, refresh it
    if (decoded.exp - currentTime < 3600) {
      const newToken = jwt.sign(
        { userId: decoded.userId },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      
      res.cookie("jwt", newToken, {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      });
    }
    
    next();
  } catch (error) {
    // If refresh fails, just continue
    next();
  }
};