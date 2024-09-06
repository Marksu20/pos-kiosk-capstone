const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const mongoose = require('mongoose');

// GET: kiosk
exports.kiosk = async (req, res) => {
  const locals = {
    title: "koka Kiosk",
    description: "koka Kiosk web application"
  }

  try {
    const products = await Product.find({ });
    const productsSold = await Product.find({ })
      .sort({ sold: -1})
      .limit(9);
    const categories = await Category.find({ })
    
    res.render('kiosk/index', {
      companyname: req.user.companyName,
      locals,
      products,
      productsSold,
      categories,
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
    let products;

    if(req.query.category) {
      var selectedCategory = await Category.findOne({ name: req.query.category });
      products = await Product.find({ category: selectedCategory._id}).populate('category');
    } else {
      products = await Product.find({}).populate('category');
    }

    products.forEach(product => {
      if (!product.price) {
        product.price = 0; // Set a default value if price is missing
      }
    });

    res.render('kiosk/allProducts', {
      companyname: req.user.companyName,
      locals,
      products,
      categories,
      selectedCategory: req.query.category || "All Products",
      selectedCategoryDescription: req.query.category ? selectedCategory.description : "All products available",
      layout: '../views/layouts/kiosk'
    });

  } catch (error) {
    console.log("error:", error);
  }
  
};

exports.cart = async (req, res) => {
  const locals = {
    title: "koka Kiosk",
    description: "koka Kiosk web application"
  }

  try {
    const products = await Product.find({ });
    const categories = await Category.find({})
    
    res.render('kiosk/cart', {
      companyname: req.user.companyName,
      locals,
      products,
      categories,
      layout: '../views/layouts/kiosk'
    });
  } catch (error) {
    console.log("error", error)
  }
}

exports.orders = async (req, res) => {
  const generateUniqueOrderNumber = async () => {
    let orderNumber;
    let exists = true;
    while (exists) {
      orderNumber = 'ORD-' + Math.floor(1000 + Math.random() * 9000);

      exists = await Order.exists({ orderNumber })
    }
    return orderNumber;
  };

  try {
    const { customerName, orderItems, orderType, totalAmount, status } = req.body;

    const orderNumber = await generateUniqueOrderNumber();
    
    // Create a new order
    const newOrder = new Order({
      user: req.user._id, 
      orderNumber,
      customerName,
      orderItems,
      orderType,
      totalAmount,
      status,
    });

    for(let item of orderItems) {
      const product = await Product.findById(item.id);
      if (product) {
        product.sold += item.quantity; // Increment sold count
        product.quantity -= item.quantity; // Decrement quantity in stock
        await product.save();
      }
    }

    const count = await Order.countDocuments({ status: 'In Process' });

    await newOrder.save();
    res.json({ 
      success: true, 
      message: 'Order saved successfully.',
      count: count 
    });

  } catch (error) {
    console.error('Error saving order:', error);
    res.json({ success: false, message: 'Failed to save order.' });
  }
}
