const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { account } = require('./adminController');

// GET: kiosk
exports.kiosk = async (req, res) => {
  const locals = {
    title: "koka Kiosk",
    description: "koka Kiosk web application"
  }

  const { accountId } = req.params;
  try {
    const user = await User.findById(accountId);
    if (!user) {
      return res.status(404).send('Account not found');
    }

    const categories = await Category.find({ user: accountId });
    const products = await Product.find({ user: accountId });
    const productsSold = await Product.find({ user: accountId })
      .sort({ sold: -1, createdAt: -1 })
      .limit(9);
    
    res.render('kiosk/index', {
      locals,
      products,
      productsSold,
      categories,
      user: req.user || {}, // Handle cases where req.user is undefined
      companyname: user ? user.companyName : null, // Show companyName only if user exists
      accountId,
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

  const { accountId } = req.params;
  try {
    const categories = await Category.find({ user: accountId });

    const user = await User.findById(accountId);
    if (!user) {
      return res.status(404).send('Account not found');
    }

    let products;
    if (req.query.category) {
      var selectedCategory = await Category.findOne({ name: req.query.category, user: accountId });
      if (selectedCategory) {
        products = await Product.find({ category: selectedCategory._id, user: accountId })
          .sort({ createdAt: -1 })
          .populate('category');
      } else {
        products = [];
      }
    } else {
      products = await Product.find({ user: accountId })
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
      companyname: user ? user.companyName : null,
      user: req.user || {},
      accountId,
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
  const generateUniqueOrderNumber = async (accountId) => {
    // Find the most recent order
    const lastOrder = await Order.findOne({ user: accountId })
      .sort({ createdAt: -1 })
      .exec();

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
    const { accountId } = req.params;
    const { customerName, orderItems, orderType, totalAmount, status, paymentMethod } = req.body;

    const user = await User.findById(accountId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // First check all products have sufficient quantity
    for (let item of orderItems) {
      let productQuery = { _id: item.id, user: accountId };
      const product = await Product.findOne(productQuery);

      if (!product) {
        return res.status(404).json({ 
          success: false, 
          message: `Product ${item.id} not found or not authorized.` 
        });
      }

      // Check if quantity would go negative
      if (product.quantity - item.quantity < 0) {
        return res.status(400).json({ 
          success: false, 
          message: `Not enough stock for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}` 
        });
      }
    }

    const orderNumber = await generateUniqueOrderNumber(accountId);

    const newOrder = new Order({
      user: accountId,
      orderNumber,
      customerName,
      orderItems,
      orderType,
      totalAmount,
      status,
      paymentMethod
    });

    // Process each item in the order
    for (let item of orderItems) {
      let productQuery = { _id: item.id, user: accountId };
      const product = await Product.findOne(productQuery);

      // We already checked product exists and has sufficient quantity
      product.sold += item.quantity;
      product.quantity -= item.quantity;
      
      await product.save();
    }

    const countQuery = { status: 'Waiting', user: accountId };
    const count = await Order.countDocuments(countQuery);

    await newOrder.save();

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
    const { accountId } = req.params;
    const lastOrder = await Order.findOne({ user: accountId })
      .sort({ createdAt: -1 })
      .exec();

    const user = await User.findById(accountId);
    if (!user) {
      return res.status(404).send('Account not found');
    }

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




