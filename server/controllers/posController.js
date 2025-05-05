const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Discount = require('../models/Discount');
const Receipt = require('../models/Receipt');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const { query } = require('express');

// GET: POS
exports.pos = async (req, res) => {
  const locals = {
    title: "koka POS",
    description: "koka POS web application"
  }

  try {
    const currentCategory = req.query.category || null;
    const { category, searchTerm } = req.query;

    const categories = await Category.find({ 
      $or: [
        { user: req.user._id },
        { user: req.user.adminId }, 
      ]
    });

    const discounts = await Discount.find({ 
      $or: [
        { user: req.user._id },
        { user: req.user.adminId }, 
      ]
    });

    let query = {
      $or: [
        { user: req.user._id },
        { user: req.user.adminId },
      ]
    };

    let products;

    // filter by category
    if(req.query.category) {
      const selectedCategory = await Category.findOne({ 
        name: req.query.category,
        $or: [
          { user: req.user._id },
          { user: req.user.adminId },
        ]  
      });
      if (selectedCategory) {
        products = await Product.find({ 
          ...query, 
          category: selectedCategory._id 
        }).populate('category');
      } else {
        products = [];
      }
    } else {
      products = await Product.find(query).populate('category');
    }

    // Set a default value if price is missing
    products.forEach(product => {
      if (!product.price) {
        product.price = 0; 
      }
    });

    if(category) {
      const selectedCategory = await Category.findOne({ 
        name: category, 
        $or: [
          { user: req.user._id },
          { user: req.user.adminId },
        ] 
      });
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

    res.render('pos/index', {
      username: req.user.firstName,
      locals,
      user,
      products,
      categories,
      discounts,
      selectedCategory: req.query.category || "All Products",
      currentPath: req.path,
      currentCategory: currentCategory || '',
      searchTerm: searchTerm || '',
      companyname: req.user.companyName,
      username: req.user.displayName,
      role: req.user.role,
      layout: '../views/layouts/pos'
    });
  } catch (error) {
    console.log("error:", error)
  }
}

exports.checkQuantities = async (req, res) => {
  try {
    const productIds = req.query.ids.split(',');
    const products = await Product.find({
      _id: { $in: productIds },
      $or: [
        { user: req.user._id },
        { user: req.user.adminId },
      ]
    }).select('_id name quantity');
    
    res.json(products);
  } catch (error) {
    console.error('Error checking quantities:', error);
    res.status(500).json({ error: 'Error checking quantities' });
  }
};

exports.orderNotif = async (req, res) => {
  try {
    const latestOrder = await Order.findOne({ 
      user: { $in: [req.user._id, req.user.adminId] }, // Filter by user/admin
      status: { $nin: ['In Process', 'To Serve'] }, // Exclude 'In Process' & 'To Serve' 
    }).sort({ createdAt: -1 })
      .lean();
    
    if (!latestOrder) {
      return res.json({ success: true, newOrder: null });
    }

    if (!req.session.lastChecked || latestOrder.createdAt > req.session.lastChecked) {
      req.session.lastChecked = latestOrder.createdAt;
      return res.json({ success: true, newOrder: latestOrder });
    }

    return res.json({ success: true, newOrder: null });

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
    const order = await Order.find({ 
      user: { $in: [req.user._id, req.user.adminId] },
    }).sort({ createdAt: 1 })

    const orders = await Order.find({ 
      user: { $in: [req.user._id, req.user.adminId] },
    }).sort({ createdAt: 1 });

    const discounts = await Discount.find({ 
      user: { $in: [req.user._id, req.user.adminId] },
    }).sort({ createdAt: -1 });
    
    const user = await User.findOne();

    res.render('pos/order', {
      username: req.user.firstName,
      orderID: req.params._id,
      cashier: req.user.displayName || req.user.companyName,
      user,
      order,
      locals,
      orders,
      discounts,
      currentPath: req.path,
      companyname: req.user.companyName,
      username: req.user.displayName,
      role: req.user.role,
      layout: '../views/layouts/pos'
    });
  } catch (error) {
    console.log("error", error);
  }  
}

exports.markOrderAsDone = async (req, res) => {
  try {
    const orderId = req.params.id;

    // Update the order's status to "Done"
    const order = await Order.findByIdAndUpdate(
      orderId,
      { status: 'Done' },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(200).json({ message: 'Order marked as done', order });
  } catch (error) {
    console.error('Error marking order as done:', error);
    res.status(500).json({ error: 'Failed to mark order as done' });
  }
}

exports.orderCount = async (req, res) => {
  try {
    const count = await Order.countDocuments({ 
      user: { $in: [req.user._id, req.user.adminId] },
      status: 'Waiting'
    });
    res.json({ count });
  } catch (error) {
    console.error('Error fetching order count:', error);
    res.status(500).json({ error: 'Failed to fetch order count' });
  }
}

exports.orderLatest = async (req, res) => {
  try {
    const latestOrder = await Order.findOne({
      user: { $in: [req.user._id, req.user.adminId] },
    }).sort({ createdAt: -1 })
      .lean();
      
     // Compare with the last checked order to identify new orders
    if (!req.session.lastChecked || (latestOrder && latestOrder.createdAt > req.session.lastChecked)) {
      req.session.lastChecked = latestOrder?.createdAt || new Date();
      return res.json({ success: true, newOrder: latestOrder });
    }

    return res.json({ success: true, newOrder: null });
    
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
    const receipts = await Receipt.find({
      $or: [
        { user: req.user._id },
        { user: req.user.adminId }
      ]
     })
      .sort({ createdAt: -1})
      .lean();

    const user = await User.findOne();

    res.render('pos/receipt', {
      username: req.user.firstName,
      locals,
      receipts,
      currentPath: req.path,
      companyname: req.user.companyName,
      username: req.user.displayName,
      role: req.user.role,
      layout: '../views/layouts/pos'
    });
  } catch (error) {
    console.log("err", + error);
  }
}

exports.confirmPayment = async (req, res) => {
  try {
    const { customerName, orderItems, TotalAmount, orderType, discount, Subtotal } = req.body;
    const orderItemsArray = JSON.parse(orderItems);

    // Retry logic for saving receipt with unique orderNumber
    let maxRetries = 5;
    let attempt = 0;
    let saved = false;

    while (!saved && attempt < maxRetries) {
      attempt++;

      // Get the last receipt to find the last order number
      const lastReceipt = await Receipt.findOne(
        { companyName: req.user.companyName }, 
        {}, 
        { sort: { 'createdAt': -1 } }
      );

      let lastOrderNumber = 0;
      if (lastReceipt) {
        const match = lastReceipt.orderNumber.match(/\d+/);
        if (match) {
          lastOrderNumber = parseInt(match[0], 10);
        }
      }

      const prefix = req.user.companyName || 'KOKA';
      const newOrderNumber = `${prefix}-${String(lastOrderNumber + 1).padStart(4, '0')}`;

      const newReceipt = new Receipt({
        user: req.user._id,
        cashier: req.user.displayName || req.user.companyName,
        orderNumber: newOrderNumber,
        customerName: customerName || `Guest ${newOrderNumber}`,
        orderItems: orderItemsArray,
        orderType,
        totalAmount: TotalAmount,
        discount,
        subTotal: Subtotal,
        companyName: req.user.companyName,
      });

      // Update products
      for (let item of orderItemsArray) {
        const product = await Product.findById(item.id);
        if (!product) continue;

        product.sold += item.quantity;

        if (product.quantity !== null) {
          product.quantity = Math.max(0, product.quantity - item.quantity);

          if (product.quantity === 0 && product.sold > item.quantity) {
            product.sold = 0;
          }
        }

        await product.save();
      }

      try {
        await newReceipt.save();
        saved = true; // success
      } catch (error) {
        if (error.code === 11000 && error.keyPattern?.orderNumber) {
          // Duplicate order number — try again
          continue;
        } else {
          throw error; // Other errors
        }
      }
    }

    if (saved) {
      res.redirect('/pos');
    } else {
      res.status(500).send('Could not generate unique order number after multiple attempts.');
    }

  } catch (error) {
    console.error('Error saving order:', error);
    res.status(500).send('Server Error');
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const updatedOrder = req.body;

    if (updatedOrder?.status === "In Process") {
      updatedOrder.cashier = req.user.displayName || req.user.companyName;
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      updatedOrder,
      { new: true }
    );

    if (!order) {
      console.log("order not found");
      return res.status(404).json({ error: "Order not found" });
    }

    if (updatedOrder.status === "In Process") {
      // ✅ Calculate subtotal correctly
      const subTotal = order.orderItems.reduce((acc, item) => {
        return acc + item.price * item.quantity;
      }, 0);

      // ✅ Save subtotal to order model
      order.subTotal = subTotal;
      await order.save();

      // ✅ Check if receipt already exists
      const existingReceipt = await Receipt.findOne({ orderNumber: order.orderNumber });

      if (!existingReceipt) {
        const receiptData = {
          user: order.user,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          orderItems: order.orderItems,
          orderType: order.orderType,
          totalAmount: order.totalAmount,
          discount: order.discount,
          subTotal: subTotal, // ✅ Make sure the field name matches
          cashier: req.user.displayName || req.user.companyName,
          createdAt: new Date(),
        };

        // ✅ Create a new receipt with subtotal
        const newReceipt = new Receipt(receiptData);
        await newReceipt.save();
      } else {
        console.log("Receipt already exists for this order");

        // ✅ Optional: Update existing receipt if needed
        existingReceipt.subTotal = subTotal;
        await existingReceipt.save();
      }

      return res.status(200).json({
        message: `Order #${order.orderNumber} for ${order.customerName} has been updated to 'In Process'`,
        order,
      });
    }

    res.status(200).json({ message: "Order updated successfully", order });

  } catch (error) {
    console.error("Error updating order:", error);

    return res.status(500).json({
      error: "Failed to update the order",
      details: error.message,
    });
  }
};

exports.toServe = async (req, res) => {
  try {
    const orderId = req.params.id;

    // Update the order's status to "to Serve"
    const order = await Order.findByIdAndUpdate(
      orderId, 
      { status: 'To Serve' }, { new: true });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.status(200).json({ message: 'Order status updated to Served', order });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
}

exports.viewOrder = async (req, res) => {
  try {
    const order = await Order.findById({
      _id: req.params.id,
      user: { $in: [req.user._id, req.user.adminId] },
    });

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