const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = require("../middleware/auth");
// Fetch JWT Secret Key from Environment Variables
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secure_secret_key";

// ====================================================
// 📝 ENDPOINT: POST /api/auth/signup
// @desc: Register a new user with encrypted password
// ====================================================
router.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Step 1: Validate payload inputs
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "All registration fields are required." });
        }

        // Step 2: Check if user already exists in the database
        let existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "An account with this email address already exists." });
        }

        // Step 3: Securely hash the plain-text password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Step 4: Instanciate and persist new user instance
        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });

        await newUser.save();

        res.status(201).json({ success: true, message: "User account created successfully." });
    } catch (error) {
        console.error("Server Error During Signup Flow:", error);
        res.status(500).json({ success: false, message: "Internal Server Error occurred during user registration." });
    }
});

// ====================================================
// 🔑 ENDPOINT: POST /api/auth/login
// @desc: Authenticate credentials and return session token
// ====================================================
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Step 1: Validate payload inputs
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password fields are required." });
        }

        // Step 2: Verify if the user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid email credentials or password matching failed." });
        }

        // Step 3: Compare submitted password hash with persisted database hash
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "Invalid email credentials or password matching failed." });
        }

        // Step 4: Generate JSON Web Token (JWT) signed session payload
        const token = jwt.sign(
            { userId: user._id },
            JWT_SECRET,
            { expiresIn: "24h" }
        );

        // Step 5: Send structured secure JSON response back to client
        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error("Server Error During Login Flow:", error);
        res.status(500).json({ success: false, message: "Internal Server Error occurred during authentication." });
    }
});

// ====================================================
// 🔍 ENDPOINT: GET /api/auth/profile
// @desc: Retrieve authenticated user's database records (excluding password)
// ====================================================
router.get("/profile", auth, async (req, res) => {
    try {
        // Find user by ID embedded in the token payload, omitting the password field
        const user = await User.findById(req.user.userId).select("-password");
        
        if (!user) {
            return res.status(404).json({ success: false, message: "User profile not found." });
        }

        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error("Error retrieving user profile:", error);
        res.status(500).json({ success: false, message: "Internal server error fetching profile data." });
    }
});

module.exports = router;