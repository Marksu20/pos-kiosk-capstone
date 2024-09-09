const Product = require('../models/Product');
const Category = require('../models/Category');
const Stock = require('../models/Stock');
const Discount = require('../models/Discount');
const Receipt = require('../models/Receipt');
const User = require('../models/User');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// const upload = multer({ dest: 'public/uploads/' });

// GET: amdin
exports.admin = async (req, res) => {

}

exports.dashboard = async (req, res) => {
  const locals = {
    title: "Dashboard",
    description: "koka POS web application"
  }
  
  async function calculateDashboardMetrics() { 
    try {
      const totalCustomers = await Receipt.distinct('customerName').countDocuments();
      const totalSales = await Receipt.countDocuments();
  
      totalRevenue = await Receipt.aggregate([
        {
          $group: {
            _id: null,
            total: {$sum : "$totalAmount"}
          }
        }
      ]);
  
      const totalExpenses = await Stock.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ["$quantity", "$cost"]}}
          }
        }
      ]);

      const totalQuantitySold = await Product.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$sold" }
          }
        }
      ]);

      const topSellingProducts = await Product.aggregate([
        {
          $project : {
            name: 1,
            sold: 1,
            totalRevenue: { $multiply: ["$sold", "$price"]}
          }
        },
        { $sort: { sold: -1 } },
        { $limit: 5 }
      ]);
      
      return {
        totalCustomers: totalCustomers || 0,
        totalSales: totalSales || 0,
        totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
        totalExpenses: totalExpenses.length > 0 ? totalExpenses[0].total : 0,
        totalQuantitySold: totalQuantitySold.length > 0 ? totalQuantitySold[0].total : 0,
        topSellingProducts
      };
  
    } catch (error) {
      console.error('Error calculating dashboard metrics:', error);
      return {
        totalCustomers: 0,
        totalSales: 0,
        totalRevenue: 0,
        totalExpenses: 0,
        totalQuantitySold: 0,
        topSellingProducts: [],
      };
    }
  }

  try {
    const recentOrders = await Receipt.find({ }).sort({ createdAt: -1}).limit(10);
    const metrics = await calculateDashboardMetrics();


    res.render('admin/dashboard', {
      username: req.user.firstName,
      locals,
      totalCustomers: metrics.totalCustomers,
      totalSales: metrics.totalSales,
      totalRevenue: metrics.totalRevenue,
      totalExpenses: metrics.totalExpenses,
      totalQuantitySold: metrics.totalQuantitySold,
      topSellingProducts: metrics.topSellingProducts,
      recentOrders,
      companyname: req.user.companyName,
      currentPath: req.path,
      layout: '../views/layouts/admin'
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).send('Server Error');
  }
}

exports.product = async (req, res) => {
  const locals = {
    title: "Products",
    description: "koka POS web application"
  }

  try {
    const products = await Product.find({}).populate('category').exec();
    const categories = await Category.find({}); 

    res.render('admin/product', {
      username: req.user.firstName,
      locals,
      products,
      categories,
      companyname: req.user.companyName,
      currentPath: req.path,
      layout: '../views/layouts/admin'
    });
  } catch (error) {
    console.log("error", error)
  }
}

exports.category = async (req, res) => {
  const locals = {
    title: "Category",
    description: "koka POS web application"
  }
  
  try {
    const categories = await Category.find({});

    res.render('admin/category', {
      username: req.user.firstName,
      locals,
      categories,
      companyname: req.user.companyName,
      currentPath: req.path,
      layout: '../views/layouts/admin'
    });
  } catch (error) {
    console.log("err", + error)
  }
}

exports.stock = async (req, res) => {
  const locals = {
    title: "Stocks",
    description: "koka POS web application"
  }

  try {
    const stocks = await Stock.find({});

    res.render('admin/stock', {
      username: req.user.firstName,
      locals,
      stocks,
      companyname: req.user.companyName,
      currentPath: req.path,
      layout: '../views/layouts/admin'
    });
  } catch (error) {
    console.log("err", + error);
  }
}

exports.receipt = async (req, res) => {
  const locals = {
    title: "Receipts",
    description: "koka POS web application"
  }

  try {
    const receipts = await Receipt.find({ });

    res.render('admin/receipt', {
      username: req.user.firstName,
      locals,
      receipts,
      companyname: req.user.companyName,
      currentPath: req.path,
      layout: '../views/layouts/admin'
    });
  } catch (error) {
    console.log("err", + error);
  }
}

exports.discount = async (req, res) => {
  const locals = {
    title: "Discounts",
    description: "koka POS web application"
  }

  try {
    const discounts = await Discount.find({});

    res.render('admin/discount', {
      username: req.user.firstName,
      locals,
      discounts,
      companyname: req.user.companyName,
      currentPath: req.path,
      layout: '../views/layouts/admin'
    });
  } catch (error) {
    console.log("error", error)
  }
  
}

exports.account = async (req, res) => {
  const locals = {
    title: "Account",
    description: "koka POS web application"
  }
  
  

  res.render('admin/account', {
    username: req.user.firstName,
    displayname: req.user.displayName,
    emailaddress: req.user.emailAddress,
    profileimage: req.user.profileImage,
    companyname: req.user.companyName,
    adminpassword: req.user.adminPassword,
    accountID: req.user._id,
    locals,
    currentPath: req.path,
    layout: '../views/layouts/admin'
  });
}

exports.viewProduct = async (req, res) => {
  const product = await Product.findById({ _id: req.params.id })
    .where({ user: req.user.id })
    .populate('category')
    .lean();
  const products = await Product.find({}).populate('category').exec();;
  const categories = await Category.find({})
    .lean();

    if(product) {
      res.render('admin/view-product', {
        username: req.user.firstName, 
        productID: req.params.id,
        product,
        products,
        categories,
        currentPath: req.path,
        companyname: req.user.companyName,
        layout: '../views/layouts/admin'
      });
    } else {
      res.send("cannot find product")
    }
}

exports.viewCategory = async (req, res) => {
  const category = await Category.findById({ _id: req.params.id }).where({ user: req.user.id }).lean()
  const categories = await Category.find({});

  if(category) {
    res.render('admin/view-category', {
      username: req.user.firstName,
      categoryID: req.params.id,
      category,
      categories,
      currentPath: req.path,
      companyname: req.user.companyName,
      layout: '../views/layouts/admin'
    });
  } else {
    res.send("something went wrong.")
  }
}

exports.viewStock = async (req, res) => {
  try {
    const stock = await Stock.findById({ _id: req.params.id }).where({ user: req.user.id }).lean()
    const stocks = await Stock.find({});

    if(stock) {
      res.render('admin/view-stock', {
        username: req.user.firstName,
        stockID: req.params.id,
        stock,
        stocks,
        currentPath: req.path,
        companyname: req.user.companyName,
        layout: '../views/layouts/admin'
      });
    } else {
      res.send("something went wrong.")
    }
  } catch (error) {
    console.log("error", error)
  }
 
}

exports.viewDiscount = async (req, res) => {
  try {
    const discount = await Discount.findById({ _id: req.params.id }).where({ user: req.user.id }).lean()
    const discounts = await Discount.find({});

    if(discount) {
      res.render('admin/view-discount', {
        username: req.user.firstName,
        discountID: req.params.id,
        discount,
        discounts,
        currentPath: req.path,
        companyname: req.user.companyName,
        layout: '../views/layouts/admin'
      });
    } else {
      res.send("something went wrong.")
    }
  } catch (error) {
    console.log("error", error)
  }
}

// PUT/UPDATE
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).where({ user: req.user.id });

    // Check if a new image is uploaded
    let updatedImage = product.image; // default to the existing image

    if (req.file) {
      updatedImage = `/uploads/${req.file.filename}`;
      
      // Optionally, delete the old image file from the server
      if (product.image && product.image !== '/img/cafe-latter.jpg') {
        const oldImagePath = path.join(__dirname, '..', 'public', product.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
    }

    // Update the product with new data
    await Product.findOneAndUpdate(
      { _id: req.params.id },
      {
        name: req.body.name,
        category: req.body.category,
        price: req.body.price,
        quantity: req.body.quantity,
        image: updatedImage
      }
    ).where({ user: req.user.id });

    res.redirect('/pos/admin/product');
  } catch (error) {
    
  }
}

exports.updateCategory = async (req, res) => {
  try {
    await Category.findOneAndUpdate(
      { _id: req.params.id },
      { name: req.body.name,
        description: req.body.description,
      }
    ).where({ user: req.user.id });
    res.redirect('/pos/admin/category');
  } catch (error) {
    console.log("error", error)
  }
}

exports.updateStock = async (req, res) => {
  try {
    await Stock.findOneAndUpdate(
      { _id: req.params.id },
      { item: req.body.item,
        quantity: req.body.quantity,
        cost: req.body.cost
      }
    ).where({ user: req.user.id });
    res.redirect('/pos/admin/stock');
  } catch (error) {
    console.log("error", error)
  }
} 

exports.updateDiscount = async (req, res) => {
  try {
    await Discount.findOneAndUpdate(
      { _id: req.params.id },
      { name: req.body.name,
        value: req.body.value,
        description: req.body.description
      }
    ).where({ user: req.user.id });
    res.redirect('/pos/admin/discount');
  } catch (error) {
    console.log("error", error)
  }
}

exports.updateAccount = async (req, res) => {
  try {
    const { companyName, adminPassword } = req.body;
    const accountID = req.params.id;

    if(!companyName) {
      return res.status(400).json({ success: false, message: 'Company name is required.' });
    }

    let updateFields = { companyName };
    if (adminPassword) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      updateFields.adminPassword = hashedPassword;
    }

    // Find the account by ID and update it
    await User.findByIdAndUpdate(accountID, updateFields);

    res.json({ success: true, message: 'Account information updated successfully.' });
  } catch (error) {
    console.error('Update Account Error:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
}

exports.adminLogin = async (req, res) => {
  const locals = {
    title: "Enter Password",
    description: "koka POS web application",
  }

  res.render('admin/admin-login', {
    username: req.user.firstName,
    currentPath: req.path,
    companyname: req.user.companyName,
    locals,
    error: null,
    layout: '../views/layouts/admin'
  });
}

exports.adminEntry = async (req, res) => {
  const user = await User.findById(req.user.id);

  const isMatch = await bcrypt.compare(req.body.password, user.adminPassword);
  if (isMatch) {
    req.session.adminAuthenticated = true;
    req.session.lastActivity = Date.now(); // Reset the last activity time
    res.redirect('/pos/admin/dashboard');
  } else {
    res.render('admin/admin-login', {
      username: req.user.firstName,
      currentPath: req.path,
      companyname: req.user.companyName,
      error: 'Incorrect Password.', 
      layout: '../views/layouts/admin'
    });
  }
};

// DELETE
exports.deleteProduct = async (req, res) => {
  try {
    await Product.deleteOne({ _id: req.params.id }).where({ user: req.user.id });
    res.redirect('/pos/admin/product');
  } catch (error) {
    console.log("error", error)
  }
}

exports.deleteCategory = async (req, res) => {
  try {
    await Category.deleteOne({ _id: req.params.id }).where({ user: req.user.id });
    res.redirect('/pos/admin/category');
  } catch (error) {
    console.log("error", error)
  }
}

exports.deleteStock = async (req, res) => {
  try {
    await Stock.deleteOne({ _id: req.params.id }).where({ user: req.user.id });
    res.redirect('/pos/admin/stock');
  } catch (error) {
    console.log("error", error)
  }
}

exports.deleteDiscount = async (req, res) => {
  try {
    await Discount.deleteOne({ _id: req.params.id }).where({ user: req.user.id });
    res.redirect('/pos/admin/discount');
  } catch (error) {
    console.log("error", error)
  }
}

// POST / ADD
exports.newProduct = async (req, res) => {
  const { name, category, price, quantity, newCategory, categoryDescription } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : '/img/cafe-latter.jpg';

  try {
    let categoryID = category;
    let sold = 0;

    if(newCategory && newCategory.trim() !== "") {
      const newCategoryDoc = new Category({
        user: req.user._id, 
        name: newCategory, 
        categoryDescription,
      });
      const savedCategory = await newCategoryDoc.save();
      categoryID = savedCategory._id;
    }

    const newProduct = new Product({
      user: req.user._id,
      name,
      category: categoryID,
      price,
      quantity,
      image,
      sold,
    });
    await newProduct.save();
    
    res.redirect('/pos/admin/product')
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
}

exports.newCategory = async (req, res) => {
  const { name, description } = req.body;

  const newCategory = new Category({
    user: req.user._id,
    name,
    description,
  });

  try {
    await newCategory.save();
    res.redirect('/pos/admin/category'); 
  } catch (error) {
    console.error(err);
    res.status(500).send('Server Error');
  }
}

exports.newStock = async (req, res) => {
  const { item, quantity, cost } = req.body;

  const newStock = new Stock({
    user: req.user._id,
    item,
    quantity,
    cost,
  });

  try {
    await newStock.save();
    res.redirect('/pos/admin/stock'); 
  } catch (error) {
    console.error(err);
    res.status(500).send('Server Error');
  }
}

exports.newDiscount = async (req, res) => {
  const { name, value, description } = req.body;

  const newDiscount = new Discount({
    user: req.user._id,
    name,
    value,
    description,
  });

  try {
    await newDiscount.save();
    res.redirect('/pos/admin/discount'); 
  } catch (error) {
    console.error(err);
    res.status(500).send('Server Error');
  }
} 