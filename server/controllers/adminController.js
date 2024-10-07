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
const nodemailer = require('nodemailer');
const crypto = require('crypto');
// const upload = multer({ dest: 'public/uploads/' });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'markjoshuadlcrz@gmail.com',
    pass: 'dzct bsys sqdd ctmh'
  }
});

// GET: amdin
exports.admin = async (req, res) => {
  try {
    // Render the admin page as middleware has already handled redirection
    res.render('/pos/admin', {
      username: req.user.firstName,
      companyname: req.user.companyName,
      showNavbar: true,
      layout: '../views/layouts/pos'
    });
  } catch (error) {
    console.error("Error in admin route: ", error);
    return res.status(500).send("Internal server error");
  }
}

exports.dashboard = async (req, res) => {
  const locals = {
    title: "Dashboard",
    description: "koka POS web application"
  }
  
  const { startDate, endDate } = req.query;

  async function calculateDashboardMetrics() { 
    try {
      const filter = {};

      if(startDate && endDate) {
        filter.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const totalCustomers = await Receipt.distinct('customerName', filter).countDocuments();
      const totalSales = await Receipt.countDocuments(filter);
  
      const totalRevenue = await Receipt.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: {$sum : "$totalAmount"}
          }
        }
      ]);
  
      const totalExpenses = await Stock.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: "$cost" }
          }
        }
      ]);

      const totalQuantitySold = await Product.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total: { $sum: "$sold" }
          }
        }
      ]);

      const topSellingProducts = await Product.aggregate([
        { $match: filter },
        {
          $project : {
            name: 1,
            sold: 1,
            totalRevenue: { $multiply: ["$sold", "$price"]}
          }
        },
        { $sort: { sold: -1 } },
        { $limit: 10 }
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
      showNavbar: true,
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
    const products = await Product.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('category')
      .exec()
    const categories = await Category.find({ user: req.user._id }); 

    res.render('admin/product', {
      username: req.user.firstName,
      locals,
      products,
      categories,
      companyname: req.user.companyName,
      currentPath: req.path,
      showNavbar: true,
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
    const categories = await Category.find({ user: req.user._id }).sort({ createdAt: -1 });

    res.render('admin/category', {
      username: req.user.firstName,
      locals,
      categories,
      companyname: req.user.companyName,
      currentPath: req.path,
      showNavbar: true,
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
    const stocks = await Stock.find({ user: req.user._id }).sort({ createdAt: -1});

    res.render('admin/stock', {
      username: req.user.firstName,
      locals,
      stocks,
      companyname: req.user.companyName,
      currentPath: req.path,
      showNavbar: true,
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
    const receipts = await Receipt.find({ })
      .sort({ createdAt: -1 })
      .lean();

    res.render('admin/receipt', {
      username: req.user.firstName,
      receipts,
      companyname: req.user.companyName,
      currentPath: req.path,
      locals,
      showNavbar: true,
      layout: '../views/layouts/admin'
    });
  } catch (error) {
    console.log("error",  error);
  }
}

exports.discount = async (req, res) => {
  const locals = {
    title: "Discounts",
    description: "koka POS web application"
  }

  try {
    const discounts = await Discount.find({ user: req.user._id }).sort({ createdAt: -1 });

    res.render('admin/discount', {
      username: req.user.firstName,
      locals,
      discounts,
      companyname: req.user.companyName,
      currentPath: req.path,
      showNavbar: true,
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
    showNavbar: true,
    layout: '../views/layouts/admin'
  });
}

exports.viewProduct = async (req, res) => {
  const product = await Product.findById({ _id: req.params.id })
    .where({ user: req.user.id })
    .populate('category')
    .lean();
  const products = await Product.find({})
    .populate('category')
    .exec();
  const categories = await Category.find({ })
    .sort({ createdAt: -1 })
    .lean();

    if (product) {
      // If the product has a category, find that category and move it to the top of the list
      if (product.category && product.category._id) {
        const categoryIndex = categories.findIndex(
          (category) => category._id.equals(product.category._id)
        );
        if (categoryIndex !== -1) {
          const [productCategory] = categories.splice(categoryIndex, 1); // Remove the category
          categories.unshift(productCategory); // Add it at the top of the list
        }
      } else {
        product.category = {
          _id: null,
          name: 'Uncategorized',
        };
      }

      res.render('admin/view-product', {
        username: req.user.firstName, 
        productID: req.params.id,
        product,
        products,
        categories,
        currentPath: req.path,
        companyname: req.user.companyName,
        showNavbar: true,
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
      showNavbar: true,
      layout: '../views/layouts/admin'
    });
  } else {
    res.send("something went wrong.")
  }
}

exports.viewStock = async (req, res) => {
  try {
    const stock = await Stock.findById({ _id: req.params.id })
      .where({ user: req.user.id })
      .lean()
    const stocks = await Stock.find({});

    if(stock) {
      res.render('admin/view-stock', {
        username: req.user.firstName,
        stockID: req.params.id,
        stock,
        stocks,
        currentPath: req.path,
        companyname: req.user.companyName,
        showNavbar: true,
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
        showNavbar: true,
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
        quantity: req.body.quantity || 0,
        image: updatedImage
      }
    ).where({ user: req.user.id });

    req.flash('success_msg', `A product successfully updated!`);
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
  const { companyName, adminPassword, newPassword, confirmPassword, removePassword } = req.body;
  const accountID = req.params.id;

  try {
    // Find the account by ID
    const user = await User.findById(accountID);

    //check if the user exist
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found!' });
    }

    // Update the company name
    if (companyName) {
      user.companyName = companyName;
    }
    
    // If adminPassword is provided and there is no password set, create the first password
    if(adminPassword && !user.adminPassword) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      user.adminPassword = hashedPassword;
      await user.save();
      return res.status(200).json({ success: true, message: 'Admin PIN created successfully!' });
    }

     // If a new password is being set, validate and update
    if(newPassword && confirmPassword) {
      const isMatch = await bcrypt.compare(adminPassword, user.adminPassword);

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'New PIN and confirm PIN do not match!' });
      } else if (!isMatch){
        return res.status(400).json({ success: false, message: 'Current admin PIN is incorrect!' });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      user.adminPassword = hashedNewPassword;
    }

    // If remove password checkbox is checked, remove the password
    if (removePassword) {
      const isMatch = await bcrypt.compare(adminPassword, user.adminPassword);

      if(isMatch){
        user.adminPassword = null;
        await user.save();
        return res.status(200).json({ success: true, message: 'Admin PIN remove successfully!' });
      } else {
        return res.status(400).json({ success: false, message: 'Current admin PIN is incorrect!' });
      }
    }

    // Save changes to the account
    await user.save();
    // Send success response
    res.status(200).json({ success: true, message: 'Account updated successfully!' });
  } catch (error) {
    console.error(error);
    // Send error response
    res.status(500).json({ success: false, message: 'An error occurred while updating the account.' });
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
    showNavbar: true,
    layout: '../views/layouts/admin'
  });
}

exports.sendRemovePIN = async (req, res) => {
  try {
    const { emailAddress } = req.body;
    console.log(emailAddress);

    // Generate a unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Find user by email
    const user = await User.findOne({ emailAddress: { $regex: new RegExp(`^${emailAddress}$`, 'i') } });

    if (!user) {
      console.error(`User with email ${emailAddress} not found`);
      req.flash('error_msg', 'User not found');
      return res.redirect('/pos/admin/admin-login');
    }

    // Save token and expiration time
    user.pinResetToken = token;
    user.pinResetExpires = Date.now() + 3600000; // 1 hour expiration
    await user.save();

    // Create reset link
    const resetLink = `https://kokapos.onrender.com/reset-pin/${token}`;

    // Send email
    const mailOptions = {
      from: 'markjoshuadlcrz@gmail.com',
      to: emailAddress,
      subject: 'Admin PIN Reset',
      text: `Click the following link to remove your admin PIN: ${resetLink}`,
      html: `<p>Click <a href="${resetLink}">here</a> to remove your admin PIN.</p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        req.flash('error_msg', 'Error sending email.');

        return res.redirect('/pos/admin/admin-login');
      }
      req.flash('success_msg', 'Email sent successfully. Please check your inbox.');

      return res.redirect('/pos/admin/admin-login');
    });
  } catch (err) {
    req.flash('error_msg', 'Server error.');
    return res.redirect('/pos/admin/admin-login');
  }
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
      showNavbar: true,
      layout: '../views/layouts/admin'
    });
  }
};

exports.resetPIN = async (req, res) => {
  const locals = {
    title: "Enter Password",
    description: "koka POS web application",
  }

  try {
    const user = await User.findOne({
      pinResetToken: req.params.token,
      pinResetExpires: { $gt: Date.now() } // Token is valid if expiration is in the future
    });

    if (!user) {
      return res.status(400).send('Invalid or expired token');
    }

    res.render('admin/remove-pin', {
      user,
      username: req.user.firstName,
      currentPath: req.path,
      companyname: req.user.companyName,
      locals,
      showNavbar: false,
      layout: '../views/layouts/admin' 
    });
  } catch (err) {
    console.error('Error in resetPIN:', err);
    return res.status(500).send('Server error');
  }
}

exports.removePIN = async (req, res) => {
  try {
    const { userId } = req.body;

    // Find the user and remove the admin PIN
    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).send('User not found');
    }

    user.adminPassword = null; // Remove the admin PIN
    await user.save();

    res.status(200).send('PIN removed! :)');
    // res.redirect('/pos/admin/dashboard'); // Redirect to the admin dashboard
  } catch (err) {
    console.error('Error in removePIN:', err);
    res.status(500).send('Server error');
  }
}


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
    await Discount.deleteOne({ _id: req.params.id })
      .where({ user: req.user.id });

    res.redirect('/pos/admin/discount');
  } catch (error) {
    console.log("error", error)
  }
}

exports.deleteReceipt = async (req, res) => {
  try {
    const receipt = await Receipt.findByIdAndDelete(req.params.id);

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    // Loop through the products in the receipt and update them
    for (const item of receipt.orderItems) {
      const product = await Product.findById(item.id);

      if (product) {
        product.sold = product.sold - item.quantity >= 0 ? product.sold - item.quantity : 0; // Prevent negative sold count
        product.quantity += item.quantity;

        await product.save(); // Save the product changes
      }
    }

    // Delete the receipt
    await Receipt.findByIdAndDelete(req.params.id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: 'Server error' });
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
      quantity: quantity || 0,
      image,
      sold,
    });
    await newProduct.save();
    
    // Set success flash message
    req.flash('success_msg', `"${name}" successfully added!`);
    res.redirect('/pos/admin/product');

  } catch (err) {
    console.error(err);
    // Set error flash message
    req.flash('error_msg', 'An error occurred while creating the product.');
    res.redirect('/pos/admin/product');
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

    // Set success flash message
    req.flash('success_msg', `"${name}" successfully added!`);
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

    // Set success flash message
    req.flash('success_msg', `"${item}" successfully added!`);
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

    // Set success flash message
    req.flash('success_msg', `"${name}" successfully added!`);
    res.redirect('/pos/admin/discount'); 
  } catch (error) {
    res.status(500).send('Server Error');
  }
} 