const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Receipt = require('../models/Receipt');
const TempOrder = require('../models/TempOrder');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { account } = require('./adminController');
const axios = require('axios');
const QRCode = require('qrcode');
const { config } = require('dotenv');

const generateUniqueOrderNumber = async (accountId) => {
  const lastOrder = await Order.findOne({ user: accountId })
    .sort({ createdAt: -1 })
    .exec();

  const lastReceipt = await Receipt.findOne({ user: accountId })
    .sort({ createdAt: -1 })
    .exec();

  let lastOrderNumber = 0;

  if (lastOrder && lastOrder.orderNumber) {
    const num = parseInt(lastOrder.orderNumber.replace(/\D/g, ''), 10);
    if (!isNaN(num)) lastOrderNumber = num;
  }

  if (lastReceipt && lastReceipt.orderNumber) {
    const num = parseInt(lastReceipt.orderNumber.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > lastOrderNumber) lastOrderNumber = num;
  }

  // Increment by 1
  const newOrderNumber = String(lastOrderNumber + 1).padStart(4, '0');
  return newOrderNumber;
};

// GET: kiosk
exports.kioskShop = async (req, res) => {
  const locals = {
    title: "Kiosk Shop",
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
      .limit(8);

    //fallback if no products sold
    if (!productsSold || productsSold.length === 0) {
      productsSold = await Product.find({ user: accountId })
        .sort({ name: 1 })
        .limit(8);
    }
    
    res.render('kiosk-shop/index', {
      locals,
      products,
      productsSold,
      categories,
      user: req.user || {}, // Handle cases where req.user is undefined
      companyname: user ? user.companyName : null, // Show companyName only if user exists
      accountId,
      layout: '../views/layouts/kiosk-shop'
    });
  } catch (error) {
    console.log("error", error)
  }
};

exports.allProducts = async (req, res) => {
  const locals = {
    title: "Kiosk Shop",
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
          .sort({ name: 1 })
          .populate('category');
      } else {
        products = [];
      }
    } else {
      products = await Product.find({ user: accountId })
        .sort({ name: 1 })
        .populate('category');
    }
    
    // Ensure all products have a price (set default to 0 if missing)
    products.forEach(product => {
      if (!product.price) {
        product.price = 0; // Set a default value if price is missing
      }
    });

    res.render('kiosk-shop/allProducts', {
      companyname: user ? user.companyName : null,
      user: req.user || {},
      accountId,
      locals,
      products,
      categories,
      selectedCategory: req.query.category || "All Products",
      selectedCategoryDescription: req.query.category ? selectedCategory.description : "All products",
      layout: '../views/layouts/kiosk-shop'
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

    // Use the same logic as order creation
    const newOrderNumber = await generateUniqueOrderNumber(accountId);

    const user = await User.findById(accountId);
    if (!user) {
      return res.status(404).send('Account not found');
    }

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
              breakdown: {
                item_total: {
                  currency_code: 'PHP',
                  value: req.body.amount,
                },
              },
            },
            items: orderItems.map(item => ({
              name: item.name,
              sku: item.id,
              unit_amount: {
                currency_code: 'PHP',
                value: (item.price).toFixed(2),
              },
              quantity: item.quantity.toString(),
            })),
          },
        ],
        application_context: {
          brand_name: 'Koka Kiosk',
          return_url: `${process.env.BASE_URL}/kiosk/thank-you`, // ✅ Update to your landing page
          cancel_url: `${process.env.BASE_URL}/${accountId}/kiosk`, // ✅ Or whatever page you want
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
    res.status(500).json({ error: 'Failed to create PayPal order', details: err.response?.data || err.message });
  }
};

exports.capturePaypalOrder = async (req, res) => {
  const { orderID, customerName, totalAmount, orderType, orderItems, accountId } = req.body;

  try {
    // Get access token
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

    // Capture order
    const capture = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
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

      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${item.id} not found or not authorized.`,
        });
      }

      // If product quantity is null, skip deduction
      if (product.quantity === null) {
        product.sold += item.quantity; // Update sold count
      } else {
        // Deduct quantity if it is not null and sufficient stock is available
        product.sold += item.quantity;
        product.quantity -= item.quantity;
      }

      await product.save();
    }

    await newOrder.save();

    res.json({ success: true, orderNumber: orderNumber, });
  } catch (error) {
    console.error('Capture Error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Payment capture failed' });
  }
};

exports.createQrPaypalOrder = async (req, res) => {
  const { orderItems, totalAmount, customerName, orderType, accountId } = req.body;

  try {
    // 1. Get PayPal Access Token
    const auth = await axios({
      method: 'post',
      url: `${process.env.PAYPAL_API}/v1/oauth2/token`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: {
        username: process.env.PAYPAL_CLIENT_ID,
        password: process.env.PAYPAL_CLIENT_SECRET,
      },
      data: 'grant_type=client_credentials',
    });

    const accessToken = auth.data.access_token;

    // 2. Create PayPal Order
    const order = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'PHP',
            value: totalAmount,
          },
        }],
        application_context: {
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
          return_url: `${process.env.BASE_URL}/kiosk-shop/success-payment?accountId=${accountId}`,
          cancel_url: `${process.env.BASE_URL}/kiosk`,
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const paypalOrderId = order.data.id;
    const paypalApproveUrl = order.data.links.find(link => link.rel === 'approve')?.href;

    // 3. Generate QR Code from PayPal Approval URL
    const qrImage = await QRCode.toDataURL(paypalApproveUrl);

    res.json({
      success: true,
      qrCode: qrImage,
      paypalOrderId: paypalOrderId,
    });

    await TempOrder.create({
      paypalOrderId,
      accountId,
      totalAmount,
      customerName,
      orderType,
      orderItems,
      status: 'Pending',
    });


  } catch (err) {
    console.error('PayPal QR create error:', err.response?.data || err.message);
    res.status(500).json({ success: false, message: 'QR PayPal Order creation failed' });
  }
};

exports.successPayment = async (req, res) => {
  const orderID = req.query.token;
  const accountId = req.query.accountId;

  if (!orderID || !accountId) {
    return res.render('kiosk-shop/success-payment', {
      success: false,
      message: 'Missing PayPal order ID or account ID.'
    });
  }

  if (!orderID) {
    return res.render('kiosk-shop/success-payment', { 
      success: false, message: 'Missing order ID.' 
    });
  }

  try {
    // Get PayPal access token
    const auth = await axios({
      method: 'post',
      url: `${process.env.PAYPAL_API}/v1/oauth2/token`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: {
        username: process.env.PAYPAL_CLIENT_ID,
        password: process.env.PAYPAL_CLIENT_SECRET,
      },
      data: 'grant_type=client_credentials',
    });
    const accessToken = auth.data.access_token;

    // Capture the order
    const capture = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const capturedOrder = capture.data;
    let amountPaid = 0;
      if (
        capturedOrder &&
        capturedOrder.purchase_units &&
        capturedOrder.purchase_units[0] &&
        capturedOrder.purchase_units[0].payments &&
        capturedOrder.purchase_units[0].payments.captures &&
        capturedOrder.purchase_units[0].payments.captures[0] &&
        capturedOrder.purchase_units[0].payments.captures[0].amount
      ) {
        amountPaid = capturedOrder.purchase_units[0].payments.captures[0].amount.value;
      } else {
        console.error('Unexpected PayPal capture response:', JSON.stringify(capturedOrder, null, 2));
        return res.render('kiosk-shop/success-payment', {
          success: false,
          message: 'Payment capture response invalid. Please contact support.',
        });
      }

    const tempOrder = await TempOrder.findOne({ paypalOrderId: orderID });

    if (!tempOrder) {
      return res.render('kiosk-shop/success-payment', {
        success: false,
        message: 'Temporary order not found.',
      });
    }

    tempOrder.status = 'Paid';
    await tempOrder.save();

    const orderNumber = await generateUniqueOrderNumber(accountId);

    for (let item of tempOrder.orderItems) {
      const product = await Product.findOne({ _id: item.id, user: accountId });
      if (!product) {
        return res.render('kiosk-shop/success-payment', {
          success: false,
          message: `Product ${item.name} not found or not authorized.`,
        });
      }
      if (product.quantity !== null) {
        product.sold += item.quantity;
        product.quantity -= item.quantity;
      } else {
        product.sold += item.quantity;
      }
      await product.save();
    }

    const newOrder = new Order({
      user: accountId,
      orderNumber,
      customerName: tempOrder.customerName || 'Walk-in Customer',
      orderItems: tempOrder.orderItems, 
      orderType: tempOrder.orderType, // Default or dynamic
      totalAmount: amountPaid,
      paymentMethod: 'PayPal',
      status: 'Waiting',
    });

    await newOrder.save();

    res.render('kiosk-shop/success-payment', { 
      success: true, 
      message: 'Payment successful!' 
    });
  } catch (error) {
    console.error('PayPal capture error:', error.response?.data || error.message);
    res.render('kiosk-shop/success-payment', { 
      success: false, 
      message: 'Payment capture failed.'
    });
  }
}

exports.getPaypalPaymentStatus = async (req, res) => {
  const { paypalOrderId } = req.params;

  try {
    const tempOrder = await TempOrder.findOne({ paypalOrderId });

    if (!tempOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.json({ success: true, status: tempOrder.status });
  } catch (err) {
    console.error('Error checking PayPal payment status:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.confirmPaypalOrder = async (req, res) => {
  const orderID = req.query.token;

  if (!orderID) {
    return res.status(400).send('Missing order ID (token)');
  }

  try {
    // Get access token
    const auth = await axios({
      method: 'post',
      url: `${process.env.PAYPAL_API}/v1/oauth2/token`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: {
        username: process.env.PAYPAL_CLIENT_ID,
        password: process.env.PAYPAL_CLIENT_SECRET,
      },
      data: 'grant_type=client_credentials',
    });

    const accessToken = auth.data.access_token;

    // Capture order
    const capture = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Save to DB here
    console.log('CAPTURED PAYPAL ORDER', capture.data);

    // res.redirect(`/kiosk-shop`);

  } catch (error) {
    console.error('❌ Capture error:', error.response?.data || error.message);
    res.status(500).send('Payment verification failed.');
  }
};
// redeploy controlller







