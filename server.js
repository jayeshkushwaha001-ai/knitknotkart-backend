require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const crypto = require('crypto');
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');
const dns = require("dns");

// Route and Model Imports
const Order = require("./models/Order");
const Product = require("./models/Product"); 
const authRoutes = require('./routes/auth');
const adminRoutes = require("./routes/admin");

// Configure DNS Servers
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Initialize Razorpay Instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: '74.125.130.108', 
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false,
        servername: 'smtp.gmail.com' 
    }
});

// ====================================================
// 🚀 PUBLIC ROUTES
// ====================================================

app.get("/", (req, res) => {
    res.status(200).send("Backend Server is Running Successfully.");
});

app.use('/api/auth', authRoutes);

app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, products });
    } catch (error) {
        console.error("Error fetching products for shop:", error);
        res.status(500).json({ success: false, message: "Products can't be loaded." });
    }
});

app.post('/api/payment/order', async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount) {
            return res.status(400).json({ success: false, message: "Amount is required!" });
        }

        const options = {
            amount: amount * 100,
            currency: "INR",
            receipt: "rcpt_" + Math.floor(Math.random() * 100000)
        };

        const order = await razorpay.orders.create(options);
        res.status(200).json({
            success: true,
            order_id: order.id,
            amount: order.amount
        });
    } catch (error) {
        console.error("Razorpay Order Error:", error);
        res.status(500).json({ success: false, message: "Failed to create Razorpay order." });
    }
});

app.post('/api/payment/verify', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, customerDetails, cartItems, totalAmount } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            const newOrder = new Order({
                customerName: customerDetails.name,
                email: customerDetails.email,
                phone: customerDetails.phone,      
                address: customerDetails.address,
                productName: JSON.stringify(cartItems),
                amount: totalAmount,
                paymentStatus: "Paid"                     
            });

            await newOrder.save();

            const customerMailOptions = {
                from: `"KnitKnotKart" <${process.env.EMAIL_USER}>`,
                to: customerDetails.email,
                subject: '🎉 Order Confirmed! Thank you for shopping with us.',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eaddcf; background-color: #fdfbf7;">
                        <h2 style="color: #8B5E3C;">Dear ${customerDetails.name},</h2>
                        <p>Your order has been successfully placed! We will process and ship it shortly.</p>
                        <hr style="border: 1px dashed #eaddcf;" />
                        <h3>Order Summary:</h3>
                        <p><strong>Total Amount Paid:</strong> ₹${totalAmount}</p>
                        <p><strong>Delivery Address:</strong> ${customerDetails.address}</p>
                        <p><strong>Payment ID:</strong> ${razorpay_payment_id}</p>
                        <hr style="border: 1px dashed #eaddcf;" />
                        <p style="color: #795548;">Made with luxury & care — KnitKnotKart</p>
                    </div>
                `
            };

            let itemsListHTML = cartItems.map(item => `<li>${item.name} (x${item.qty}) - ₹${item.price * item.qty}</li>`).join('');

            const sellerMailOptions = {
                from: `"KnitKnotKart Notification" <${process.env.EMAIL_USER}>`,
                to: process.env.SELLER_EMAIL,
                subject: '🚨 New Order Received - KnitKnotKart',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #8B5E3C; background-color: #f5efe6;">
                        <h2 style="color: #3e2723;">New Order Alert 🎉</h2>
                        <p>You have received a new order. Details are provided below:</p>
                        <hr />
                        <h3>Customer Details:</h3>
                        <p><strong>Name:</strong> ${customerDetails.name}</p>
                        <p><strong>Email:</strong> ${customerDetails.email}</p>
                        <p><strong>Phone:</strong> ${customerDetails.phone}</p>
                        <p><strong>Address:</strong> ${customerDetails.address}</p>
                        <hr />
                        <h3>Order Items:</h3>
                        <ul>${itemsListHTML}</ul>
                        <p><strong>Total Revenue:</strong> ₹${totalAmount}</p>
                        <p><strong>Razorpay Order ID:</strong> ${razorpay_order_id}</p>
                    </div>
                `
            };

            await transporter.sendMail(customerMailOptions);
            await transporter.sendMail(sellerMailOptions);

            return res.status(200).json({ success: true, message: "Payment verified, order saved." });
        } else {
            return res.status(400).json({ success: false, message: "Invalid payment signature verification failed." });
        }
    } catch (error) {
        console.error("Verification/Email Processing Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error." });
    }
});

// ====================================================
// 🔐 SECURE ADMIN GATEWAY & MIDDLEWARE
// ====================================================

// Hardcoded Admin Credentials 
const ADMIN_USER = "gungun_"; 
const ADMIN_PASS = "24manshi_2005"; 

// 1. Security Middleware:
const verifyAdminToken = (req, res, next) => {
    
    if (req.path === '/login') {
        return next();
    }
    
    const token = req.headers['authorization'];
    if (token === "SECRET_ADMIN_TOKEN_XYZ123") {
        next(); 
    } else {
        res.status(403).json({ success: false, message: "Access Denied: Unauthenticated Request!" });
    }
};

// 2. Apply Security Guard (Middleware) to /api/admin 
app.use("/api/admin", verifyAdminToken);

// 3. Login API Endpoint 
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        res.status(200).json({ success: true, token: "SECRET_ADMIN_TOKEN_XYZ123" });
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});



app.use("/api/admin", adminRoutes);

// ====================================================
// 📡 DATABASE CONNECTION
// ====================================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Database connection established successfully."))
    .catch((err) => console.error("Database connection configuration failed:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running smoothly on port ${PORT}`);
});
