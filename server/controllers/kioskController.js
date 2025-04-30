const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { account } = require('./adminController');
const axios = require('axios');

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

      if (product.quantity === null) {
        continue;
      }

      // Check if quantity would go negative
      if (product.quantity === 0 || product.quantity - item.quantity < 0) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock for ${product.name}! \nAvailable: ${product.quantity} \nRequested: ${item.quantity}`,
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
      // Only deduct quantity if it is not null
      if (product.quantity !== null) {
        product.sold += item.quantity;
        product.quantity -= item.quantity;
      }

      await product.save();
    }

    const countQuery = ({ status: 'Waiting', user: accountId });
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

exports.validateOrderQuantities = async (req, res) => {
  const { accountId, orderItems } = req.body;

  try {
    for (let item of orderItems) {
      let productQuery = { _id: item.id, user: accountId };
      const product = await Product.findOne(productQuery);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${item.id} not found or not authorized.`,
        });
      }

      if (product.quantity === null) {
        continue; // Skip if quantity is null (unlimited stock)
      }

      if (product.quantity === 0 || product.quantity - item.quantity < 0) {
        return res.status(400).json({
          success: false,
          message: `Available: ${product.quantity} \nRequested: ${item.quantity}`,
        });
      }
    }

    res.json({ success: true, message: 'All quantities are valid.' });
  } catch (error) {
    console.error('Error validating quantities:', error);
    res.status(500).json({ success: false, message: 'Server error during validation.' });
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
      // E xtract the numeric part of the order number
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

exports.createPaypalOrder = async (req, res) => {
  const { orderID, customerName, totalAmount, orderType, orderItems, accountId } = req.body;

  try {
    const auth = await axios({
      method: 'post',
      url: `${process.env.PAYPAL_API}/v1/oauth2/token`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      auth: {
        username: process.env.PAYPAL_CLIENT_ID,
        password: process.env.PAYPAL_CLIENT_SECRET,
      },
      data: 'grant_type=client_credentials',
    });

    const accessToken = auth.data.access_token;

    const order = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'PHP',
              value: req.body.amount,
            },
          },
        ],
        application_context: {
          brand_name: 'Koka Kiosk',
          return_url: 'http://localhost:5000/kiosk/thank-you', // ✅ Update to your landing page
          cancel_url: `http://localhost:5000/${accountId}/kiosk`, // ✅ Or whatever page you want
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ id: order.data.id });
  } catch (err) {
    console.error('PayPal create error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create PayPal order' });
  }
};

exports.capturePaypalOrder = async (req, res) => {
  const { orderID, customerName, totalAmount, orderType, orderItems, accountId, orderNumber } = req.body;

  try {
    // Get access token
    const auth = await axios({
      method: 'post',
      url: 'https://api-m.sandbox.paypal.com/v1/oauth2/token',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      auth: {
        username: process.env.PAYPAL_CLIENT_ID,
        password: process.env.PAYPAL_CLIENT_SECRET,
      },
      data: 'grant_type=client_credentials',
    });

    const accessToken = auth.data.access_token;

    // Capture order
    const capture = await axios.post(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // ✅ Now Save order in DB
    const orderNumber = await generateUniqueOrderNumber(accountId);
    const numericAmount = parseFloat(totalAmount.replace(/[^\d.-]/g, ''));

    const newOrder = new Order({
      user: accountId,
      orderNumber,
      customerName,
      orderItems,
      orderType,
      totalAmount: numericAmount,
      status: 'Waiting',
      paymentMethod: 'PayPal'
    });

    for (let item of orderItems) {
      const product = await Product.findOne({ _id: item.id, user: accountId });
      product.sold += item.quantity;
      product.quantity -= item.quantity;
      await product.save();
    }

    await newOrder.save();

    res.json({ success: true, orderNumber: orderNumber, });
  } catch (error) {
    console.error('Capture Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Payment capture failed' });
  }
};







