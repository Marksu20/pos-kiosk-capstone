const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Discount = require('../models/Discount');
const Receipt = require('../models/Receipt');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const { query } = require('express');

// GET: pos
exports.pos = async (req, res) => {
  const locals = {
    title: "koka POS",
    description: "koka POS web application"
  }

  try {
    // const products = await Product.find({ });
    const categories = await Category.find({});
    const discounts = await Discount.find({});
    const currentCategory = req.query.category || null;
    const { category, searchTerm } = req.query;

    let query = {};
    let products;

    if(req.query.category) {
      var selectedCategory = await Category.findOne({ name: req.query.category });
      products = await Product.find({ category: selectedCategory._id }).populate('category');
    } else {
      products = await Product.find({}).populate('category');
    }

    products.forEach(product => {
      if (!product.price) {
        product.price = 0; // Set a default value if price is missing
      }
    });

    if(category) {
      const selectedCategory = await Category.findOne({ name: category });
      if (selectedCategory) {
        query.category = selectedCategory._id;
      }
    }

    // handle search
    if (searchTerm) {
      query.name = { $regex: searchTerm, $options: 'i' }; // Case-insensitive search
    }
    products = await Product.find(query).populate('category');
    if(req.xhr) {
      return res.json(products); //Respond with JSON if it's an AJAX request
    }

    const user = await User.findOne();

    const isPinSet = user && user.adminPassword ? true : false;

    res.render('pos/index', {
      username: req.user.firstName,
      locals,
      products,
      categories,
      discounts,
      selectedCategory: req.query.category || "All Products",
      currentPath: req.path,
      currentCategory: currentCategory || '',
      searchTerm: searchTerm || '',
      companyname: req.user.companyName,
      isPinSet,
      layout: '../views/layouts/pos'
    });
  } catch (error) {
    console.log("error:", error)
  }
  
};

exports.orderNotif = async (req, res) => {
  try {
    const latestOrder = await Order.findOne({ status: { $ne: 'To Serve' } })// Exclude "To Serve" orders
      .sort({ createdAt: -1 }).lean();

    if (!latestOrder) {
      return res.json({ success: true, newOrder: null });
    }

    // console.log(latestOrder);
    // Compare with a timestamp stored in the session to check if this is a new order
    if (latestOrder.createdAt > req.session.lastChecked && latestOrder.status !== 'To Serve') {
      req.session.lastChecked = latestOrder.createdAt;
      return res.json({ success: true, newOrder: null });
    } else {
      req.session.lastChecked = latestOrder.createdAt;
      return res.json({ success: true, newOrder: latestOrder });
    }

  } catch (error) {
    console.error('Error fetching latest order:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch latest order.' });
  }
}

exports.order = async (req, res) => {
  const locals = {
    title: "Orders",
    description: "koka POS web application"
  }
  
  try {
    const orders = await Order.find({ }).sort({ createdAt: -1 });
    const discounts = await Discount.find({ });
    
    const user = await User.findOne();
    const isPinSet = user && user.adminPassword ? true : false;
    
    res.render('pos/order', {
      username: req.user.firstName,
      orderID: req.params._id,
      locals,
      orders,
      discounts,
      currentPath: req.path,
      companyname: req.user.companyName,
      isPinSet,
      layout: '../views/layouts/pos'
    });
  } catch (error) {
    console.log("error", + error);
  }  
}

exports.orderCount = async (req, res) => {
  try {
    const count = await Order.countDocuments({ status: 'In Process' });
    res.json({ count });
  } catch (error) {
      res.status(500).json({ error: 'Failed to fetch order count' });
  }
}

exports.orderLatest = async (req, res) => {
  try {
    const latestOrder = await Order.findOne().sort({ createdAt: -1 }).lean();

    // Compare with a timestamp stored in the session to check if this is a new order
    if (req.session.lastChecked && latestOrder.createdAt > req.session.lastChecked) {
      req.session.lastChecked = latestOrder.createdAt;
      return res.json({ success: true, newOrder: latestOrder });
    } else {
      req.session.lastChecked = latestOrder.createdAt;
      return res.json({ success: true, newOrder: null });
    }
  } catch (error) {
    console.error('Error fetching latest order:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch latest order.' });
  }
}

exports.receipt = async (req, res) => {
  const locals = {
    title: "Receipts",
    description: "koka POS web application"
  }

  try {
    const receipts = await Receipt.find({})
      .sort({ createdAt: -1});

    const user = await User.findOne();
    const isPinSet = user && user.adminPassword ? true : false;

    res.render('pos/receipt', {
      username: req.user.firstName,
      locals,
      receipts,
      currentPath: req.path,
      companyname: req.user.companyName,
      isPinSet,
      layout: '../views/layouts/pos'
    });
  } catch (error) {
    console.log("err", + error);
  }
};

exports.confirmPayment = async (req, res) => {
  try {
    const { customerName, orderItems, TotalAmount, orderType, discount } = req.body;
    
    // Parse the orderItems JSON string to an array
    const orderItemsArray = JSON.parse(orderItems);

    // Get the last receipt to find the last order number
    const lastReceipt = await Receipt.findOne({}, {}, { sort: { 'createdAt': -1 } });

    // Generate the next order number
    let newOrderNumber = '0001';
    if (lastReceipt) {
      var lastOrderNumber = parseInt(lastReceipt.orderNumber.replace('#', ''), 10); // Get the numeric part
      
      // Check if the parsed number is valid
      if (!isNaN(lastOrderNumber)) {
        newOrderNumber = `${String(lastOrderNumber + 1).padStart(4, '0')}`; // Increment and format
      }
      // newOrderNumber = `#${String(lastOrderNumber + 1).padStart(4, '0')}`; // Increment and format
  
    }

    const newReceipt = new Receipt({
      user: req.user._id,
      orderNumber: newOrderNumber, // Set the order number 
      customerName: customerName || `Guest ${String(lastOrderNumber + 1).padStart(4, '0')}`,
      orderItems: orderItemsArray,
      orderType,
      totalAmount: TotalAmount,
      discount,
    });

    // Iterate over orderItems and update product's sold count and quantity in stock
    for (let item of orderItemsArray) {
      const product = await Product.findById(item.id);

      if (!product) {
        continue; // Skip if product is not found
      }

      // Increment the sold count by the ordered quantity
      product.sold += item.quantity;

      // Ensure quantity doesn't go below 0
      if (product.quantity > 0) {
        product.quantity -= item.quantity;
        // Ensure the quantity doesn't become negative
        if (product.quantity < 0) {
          product.quantity = 0;
          product.sold = 0;
        }
      }

      // Save the updated product
      await product.save();
    }

    // Save the order to the database
    await newReceipt.save();

    res.redirect('/pos');
  } catch (error) {
    console.error('Error saving order:', error);
    res.status(500).send('Server Error');
  }
  
};

exports.updateOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const updatedOrder = req.body;

    const order = await Order.findByIdAndUpdate(
      orderId,
      updatedOrder, 
      { new: true }
    ); //{ _id: req.params.id },

    if (!order) {
      console.log("order not found")
      return res.status(404).json({ error: 'Order not found' });
    }

    if(order.status === "To Serve") {
      const receiptData = {
        user: order.user,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        orderItems: order.orderItems,
        orderType: order.orderType,
        totalAmount: order.totalAmount,
        discount: order.discount,
        createdAt: new Date(),
      };

      const newReceipt = new Receipt(receiptData);
      await newReceipt.save();
    }

    res.status(200).json({ message: 'Order updated successfully', order });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update the order' });
  }
}

exports.viewOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
}

//DELETE
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const orderNumber = await Order.find({ });
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    for (let item of order.orderItems) {
      const product = await Product.findById(item.id);
      if (product) {
        product.sold -= item.quantity; // Decrement sold count
        product.quantity += item.quantity; // Restore quantity in stock
        await product.save();
      }
    }

    // Delete the order
    await Order.deleteOne({ _id: id });

    // Return success response
    res.json({ 
      success: true, 
      message: 'Order deleted successfully.',
      orderNumber: orderNumber.orderNumber, 
    });
  } catch (error) {
    console.log("error", error)
    console.error('Error deleting order:', error);
    res.status(500).json({ success: false, message: 'Failed to delete order.' });
  }
}

exports.deleteReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const receipt = await Receipt.findById(id);

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    for (let item of receipt.orderItems) {
      const product = await Product.findById(item.id);

      if (product) {
        product.sold -= item.quantity; // Decrement sold count
        product.quantity += item.quantity; // Restore quantity in stock
        await product.save();
      }
    }

    // Delete the order
    await Receipt.deleteOne({ _id: id });

    // Return success response
    res.json({ success: true, message: 'Receipt deleted successfully.'});
  } catch (error) {
    console.log("error", error)
    console.error('Error deleting order:', error);
    res.status(500).json({ success: false, message: 'Failed to delete receipt.' });
  }
}