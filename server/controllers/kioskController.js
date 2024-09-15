const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// GET: kiosk
exports.kiosk = async (req, res) => {
  const locals = {
    title: "koka Kiosk",
    description: "koka Kiosk web application"
  }

  try {    
    // If a user is logged in, use their ID to filter products and categories.
    // If no user is logged in, fallback to a registered owner ID or public display.
    let userId = null;
    let user = null;

    // Check if the user is logged in
    if (req.user) {
      userId = req.user._id; // Use the logged-in user's ID
      user = await User.findById(userId);
    } else {
      // You can hard-code a registered owner user ID for public access
      // For example, using the first user in the database or a specific user
      const registeredOwner = await User.findOne(); // Fetch the registered user (owner)
      if (registeredOwner) {
        userId = registeredOwner._id;
        user = registeredOwner;
      }
    }

    // Fetch products and categories belonging to the registered user (owner)
    const products = await Product.find({ user: userId });
    const productsSold = await Product.find({ user: userId })
      .sort({ sold: -1, createdAt: -1 })
      .limit(9);
    const categories = await Category.find({ user: userId });
    
    res.render('kiosk/index', {
      locals,
      products,
      productsSold,
      categories,
      user: req.user || {}, // Handle cases where req.user is undefined
      companyname: user ? user.companyName : null, // Show companyName only if user exists
      layout: '../views/layouts/kiosk'
    });
  } catch (error) {
    console.log("error", error)
  }
};

exports.allProducts = async (req, res) => {
  const locals = {
    title: "koka Kiosk",
    description: "koka Kiosk web application"
  };

  try {
    const categories = await Category.find({});

    // Get the user ID of the logged-in user or default registered owner
    let userId = null;
    let user = null;

    // Check if the user is logged in
    if (req.user) {
      userId = req.user._id; // Use the logged-in user's ID
      user = await User.findById(userId);
    } else {
      // You can hard-code a registered owner user ID for public access
      // For example, using the first user in the database or a specific user
      const registeredOwner = await User.findOne(); // Fetch the registered user (owner)
      if (registeredOwner) {
        userId = registeredOwner._id;
        user = registeredOwner;
      }
    }

    let products;

    if (req.query.category) {
      var selectedCategory = await Category.findOne({ name: req.query.category, user: userId });
      products = await Product.find({ category: selectedCategory._id, user: userId })
        .sort({ createdAt: -1 })
        .populate('category');
    } else {
      products = await Product.find({ user: userId }) // Filter products by user
        .sort({ createdAt: -1 })
        .populate('category');
    }

    // Ensure all products have a price (set default to 0 if missing)
    products.forEach(product => {
      if (!product.price) {
        product.price = 0; // Set a default value if price is missing
      }
    });

    res.render('kiosk/allProducts', {
      companyname: user ? user.companyName : null, // Use the logged-in user's company name
      locals,
      products,
      categories,
      selectedCategory: req.query.category || "All Products",
      selectedCategoryDescription: req.query.category ? selectedCategory.description : "All products available",
      layout: '../views/layouts/kiosk'
    });

  } catch (error) {
    console.log("error:", error);
    res.status(500).send('Server Error');
  }
};

exports.orders = async (req, res) => {
  const generateUniqueOrderNumber = async () => {
    // Find the most recent order
    const lastOrder = await Order.findOne().sort({ createdAt: -1 }).exec();

    let newOrderNumber;

    if (lastOrder) {
      // Extract the numeric part of the order number
      const lastOrderNumber = lastOrder.orderNumber;
      const numericPart = parseInt(lastOrderNumber.replace(/\D/g, ''), 10); // Remove any non-digit characters

      // Increment the numeric part
      newOrderNumber = 'KOKA-' + (numericPart + 1).toString().padStart(4, '0'); // e.g., ORD1001
    } else {
      // If no order exists, start from 'ORD1001'
      newOrderNumber = 'KOKA-0001';
    }

    return newOrderNumber;
  };

  try {
    const { customerName, orderItems, orderType, totalAmount, status } = req.body;

    // Generate a unique order number
    const orderNumber = await generateUniqueOrderNumber();

    // Determine the user (if logged in)
    const userId = req.user ? req.user._id : null;

    // Create a new order
    const newOrder = new Order({
      user: userId, // Set to null if no user is logged in
      orderNumber,
      customerName,
      orderItems,
      orderType,
      totalAmount,
      status,
    });

    // Process each item in the order
    for (let item of orderItems) {
      let productQuery = { _id: item.id };

      // If a user is logged in, ensure they own the product
      if (userId) {
        productQuery.user = userId;
      }

      const product = await Product.findOne(productQuery); // Find the product by its ID and user (if applicable)

      if (product) {
        product.sold += item.quantity; // Increment sold count
        product.quantity -= item.quantity; // Decrement stock count
        
        // Save updated product info
        await product.save();
      } else {
        // Return error if the product is not found or unauthorized
        return res.status(404).json({ success: false, message: `Product ${item.id} not found or not authorized.` });
      }
    }

    // Count the number of 'In Process' orders
    const countQuery = { status: 'In Process' };
    if (userId) {
      countQuery.user = userId;
    }
    const count = await Order.countDocuments(countQuery);

    // Save the new order
    await newOrder.save();

    // Respond with success
    res.json({
      success: true,
      message: 'Order saved successfully.',
      count: count // Return the number of in-process orders
    });

  } catch (error) {
    console.error('Error saving order:', error);
    res.status(500).json({ success: false, message: 'Failed to save order.' });
  }
};

exports.generateOrderNumber = async (req, res) => {
  try {
    // Find the most recent order
    const lastOrder = await Order.findOne().sort({ createdAt: -1 }).exec();

    let newOrderNumber;

    if (lastOrder) {
      // Extract the numeric part of the order number
      const lastOrderNumber = lastOrder.orderNumber;
      const numericPart = parseInt(lastOrderNumber.replace(/\D/g, ''), 10); // Remove any non-digit characters

      // Increment the numeric part
      newOrderNumber = 'KOKA-' + (numericPart + 1).toString().padStart(4, '0'); // e.g., ORD1001
    } else {
      // If no order exists, start from 'ORD1001'
      newOrderNumber = 'KOKA-0001';
    }

    // Send the new order number as the response
    res.json({ success: true, orderNumber: newOrderNumber });
  } catch (error) {
    console.error('Error generating order number:', error);
    res.status(500).json({ success: false, message: 'Failed to generate order number.' });
  }
};




