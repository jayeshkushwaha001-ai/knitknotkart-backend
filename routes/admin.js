const express = require("express");
const router = express.Router();
const Order = require("../models/Order"); 
const Product = require("../models/Product"); 

// ==========================================
// 📦 ORDERS MANAGEMENT 
// ==========================================

// GET All Orders
router.get("/orders", async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: orders.length, orders });
    } catch (error) {
        console.error("Error fetching admin orders:", error);
        res.status(500).json({ success: false, message: "Error retrieving orders log." });
    }
});

// PATCH Update Order Status
router.patch("/orders/:id", async (req, res) => {
    const { status } = req.body;
    try {
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { paymentStatus: status },
            { new: true }
        );
        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: "Order records not found." });
        }
        res.status(200).json({ success: true, message: `Order status updated to ${status}` });
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ success: false, message: "Failed to update tracking parameters." });
    }
});

// ==========================================
// 🛍️ PRODUCT MANAGEMENT
// ==========================================

// 1. GET ALL PRODUCTS (Admin Dashboard)
router.get("/products", async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false, message: "Issue in fetching products." });
    }
});

// 2. POST ADD NEW PRODUCT 
router.post("/products", async (req, res) => {
    try {
        const { name, description, price, img, category } = req.body;
        const newProduct = new Product({ name, description, price, img, category });
        await newProduct.save();
        res.status(201).json({ success: true, message: "Product Added Successfully! 🎉", product: newProduct });
    } catch (error) {
        res.status(500).json({ success: false, message: "Product didn't added." });
    }
});

// 3. PUT UPDATE PRODUCT 
router.put("/products/:id", async (req, res) => {
    try {
        const { name, description, price, img, category } = req.body;
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            { name, description, price, img, category },
            { new: true }
        );
        if (!updatedProduct) return res.status(404).json({ success: false, message: "Product not found." });
        
        res.status(200).json({ success: true, message: "Product Updated Successfully! ✏️", product: updatedProduct });
    } catch (error) {
        res.status(500).json({ success: false, message: "Updation failed." });
    }
});

// 4. DELETE PRODUCT 
router.delete("/products/:id", async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) return res.status(404).json({ success: false, message: "Product not found." });
        
        res.status(200).json({ success: true, message: "Product Removed Successfully! 🗑️" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Product didn't remove." });
    }
});

module.exports = router;