const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secure_secret_key";

/**
 * Middleware to protect backend routes by verifying the incoming JWT token.
 */
module.exports = function (req, res, next) {
    // Extract the token from the Authorization header
    const authHeader = req.header("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ 
            success: false, 
            message: "Authorization denied. Missing or invalid token format." 
        });
    }

    // Split 'Bearer <token>' to get only the token string
    const token = authHeader.split(" ")[1];

    try {
        // Verify token authenticity
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Attach the decrypted user payload (userId) to the request object
        req.user = decoded; 
        next(); // Pass control to the next handler/route
    } catch (error) {
        console.error("Token verification failed:", error.message);
        res.status(401).json({ 
            success: false, 
            message: "Session expired or invalid token. Please authenticate again." 
        });
    }
};