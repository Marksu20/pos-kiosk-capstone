const Product = require('../models/Product');
const Category = require('../models/Category');
const Stock = require('../models/Stock');
const Discount = require('../models/Discount');
const Receipt = require('../models/Receipt');
const User = require('../models/User');
const Log = require('../models/Log');
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

function formatToLocal(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }); // Change to your timezone
}

async function saveProductLog({ action, productName, newValue, user, comment, category }) {
  const now = new Date();
  let message = '';
  switch (action) {
    case 'updateName':
      message = `Update ${productName} name into ${newValue} by ${user}: ${comment}`;
      break;
    case 'updateCategory':
      message = `Update ${productName} category into ${newValue} by ${user}: ${comment}`;
      break;
    case 'updatePrice':
      message = `Update ${productName} price into ${newValue} by ${user}: ${comment}`;
      break;
    case 'updateQuantity':
      message = `Update ${productName} quantity into ${newValue} by ${user}: ${comment}`;
      break;
    case 'updateImage':
      message = `Update ${productName} image into ${newValue} by ${user}: ${comment}`;
      break;
    case 'create':
      message = `Create item ${productName} by ${user}: ${comment}`;
      break;
    case 'delete':
      message = `Delete item ${productName} by ${user}: ${comment}`;
      break;
    default:
      message = `Unknown action on ${productName} by ${user}: ${comment}`;
  }
  await Log.create({
    message,
    timestamp: now,
    user,
    action,
    productName,
    newValue,
    category,
    comment,
    formattedDate: now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
  });
}

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
  };

  const { startDate, endDate, today } = req.query;

  const receiptFilter = {
    $or: [
      { user: req.user._id },
      { user: req.user.adminId }
    ]
  };

  if (today === 'true') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    receiptFilter.createdAt = { $gte: start, $lte: end };
  } else if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    let end;
    if (endDate) {
      end = new Date(endDate);
    } else {
      end = new Date(startDate); // single day
    }
    end.setHours(23, 59, 59, 999);

    receiptFilter.createdAt = { $gte: start, $lte: end };
  }

  async function calculateDashboardMetrics(filter) {
    try {
      const totalCustomersArr = await Receipt.distinct('customerName', filter);
      const totalCustomers = totalCustomersArr.length;

      const totalSales = await Receipt.countDocuments(filter);

      const totalRevenue = await Receipt.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]);

      const totalQuantitySold = await Receipt.aggregate([
        { $match: filter }, // filter includes today's date range
        { $unwind: "$orderItems" },
        {
          $group: {
            _id: null,
            total: { $sum: "$orderItems.quantity" }
          }
        }
      ]);      

      const topSellingProducts = await Receipt.aggregate([
        { $match: filter }, // filter has today's date range
        { $unwind: "$orderItems" },
        {
          $group: {
            _id: "$orderItems.name",
            totalSold: { $sum: "$orderItems.quantity" },
            totalRevenue: {
              $sum: { $multiply: ["$orderItems.quantity", "$orderItems.price"] }
            }
          }
        },
        {
          $project: {
            name: "$_id",
            totalSold: 1,
            totalRevenue: 1,
            _id: 0
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 }
      ]);      

      return {
        totalCustomers: totalCustomers || 0,
        totalSales: totalSales || 0,
        totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
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
    const recentOrders = await Receipt.find(receiptFilter)
      .sort({ createdAt: -1 })
      .limit(10);
    recentOrders.forEach(order => order.createdAtLocal = formatToLocal(order.createdAt));

    const metrics = await calculateDashboardMetrics(receiptFilter);

    res.render('admin/dashboard', {
      username: req.user.firstName,
      locals,
      totalCustomers: metrics.totalCustomers,
      totalSales: metrics.totalSales,
      totalRevenue: metrics.totalRevenue,
      // totalExpenses: metrics.totalExpenses,
      totalQuantitySold: metrics.totalQuantitySold,
      topSellingProducts: metrics.topSellingProducts,
      recentOrders,
      companyname: req.user.companyName,
      username: req.user.displayName,
      role: req.user.role,
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
    const products = await Product.find({ 
      $or: [
        { user: req.user._id },
        { user: req.user.adminId}
      ] 
    }).sort({ createdAt: -1 })
      .populate('category')
      .exec();
    products.forEach(p => p.createdAtLocal = formatToLocal(p.createdAt));
    
      
    const categories = await Category.find({ 
      $or: [
        { user: req.user._id },
        { user: req.user.adminId }
      ]
     }); 

    res.render('admin/product', {
      username: req.user.firstName,
      locals,
      products,
      categories,
      companyname: req.user.companyName,
      username: req.user.displayName,
      role: req.user.role,
      currentPath: req.path,
      showNavbar: true,
      layout: '../views/layouts/admin'
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).send("An error occurred while fetching products.");
  }
}

exports.category = async (req, res) => {
  const locals = {
    title: "Category",
    description: "koka POS web application"
  }
  
  try {
    const categories = await Category.find({ 
      $or : [
        { user: req.user._id },
        { user: req.user.adminId },
      ]
     }).sort({ createdAt: -1 });
    categories.forEach(c => c.createdAtLocal = formatToLocal(c.createdAt));

    res.render('admin/category', {
      username: req.user.firstName,
      locals,
      categories,
      companyname: req.user.companyName,
      username: req.user.displayName,
      role: req.user.role,
      currentPath: req.path,
      showNavbar: true,
      layout: '../views/layouts/admin'
    });
  } catch (error) {
    console.log("err", + error);
    res.status(500).send("An error occurred while fetching categories.");
  };
}

exports.stock = async (req, res) => {
  const locals = {
    title: "Stocks",
    description: "koka POS web application"
  }

  try {
    const stocks = await Stock.find({ 
      $or : [
        { user: req.user._id },
        { user: req.user.adminId },
      ]
     }).sort({ createdAt: -1});

    res.render('admin/stock', {
      username: req.user.firstName,
      locals,
      stocks,
      companyname: req.user.companyName,
      username: req.user.displayName,
      role: req.user.role,
      currentPath: req.path,
      showNavbar: true,
      layout: '../views/layouts/admin'
    });
  } catch (error) {
    console.log("err", + error);
    res.status(500).send("An error occurred while fetching stocks.");
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
      .sort({ createdAt: -1 })
      .lean();
    receipts.forEach(r => r.createdAtLocal = formatToLocal(r.createdAt));
      
    res.render('admin/receipt', {
      username: req.user.firstName,
      receipts,
      companyname: req.user.companyName,
      username: req.user.displayName,
      role: req.user.role,
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
    const discounts = await Discount.find({ 
      $or: [
        { user: req.user._id },
        { user: req.user.adminId }
      ]
     }).sort({ createdAt: -1 });
    discounts.forEach(d => d.createdAtLocal = formatToLocal(d.createdAt));

    res.render('admin/discount', {
      username: req.user.firstName,
      locals,
      discounts,
      companyname: req.user.companyName,
      username: req.user.displayName,
      role: req.user.role,
      currentPath: req.path,
      showNavbar: true,
      layout: '../views/layouts/admin'
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).send("An error occurred while fetching discounts.");
  };
}

exports.account = async (req, res) => {
  try {
    const locals = {
      title: "Account",
      description: "koka POS web application"
    };

    const { role } = req.query;

    const query = { adminId: req.user._id };
    if (role && role !== 'All Users') {
      query.role = role;
    }
  
    const users = await User.find(query).sort({ createdAt: -1 });
    users.forEach(u => u.createdAtLocal = formatToLocal(u.createdAt));

    res.render('admin/account', {
      username: req.user.firstName,
      displayname: req.user.displayName,
      emailaddress: req.user.emailAddress,
      profileimage: req.user.profileImage,
      companyname: req.user.companyName,
      username: req.user.displayName,
      role: req.user.role,
      adminpassword: req.user.adminPassword,
      accountID: req.user._id,
      locals,
      currentPath: req.path,
      showNavbar: true,
      users,
      user: req.user._id || req.user.adminId,
      selectedRole: role || 'All Users',
      layout: '../views/layouts/admin'
    });
  } catch(error) {
    console.error(error);
    res.status(500).send('Server Error');
  } 
}

exports.logs = async (req, res) => {
  try {
    const locals = {
      title: "Account",
      description: "koka POS web application"
    };

    const logs = await Log.find({}).sort({ timestamp: -1 }).lean();
    
    res.render('admin/logs', {
      logs,
      username: req.user.firstName,
      companyname: req.user.companyName,
      username: req.user.displayName,
      role: req.user.role,
      currentPath: req.path,
      locals,
      showNavbar: true,
      layout: '../views/layouts/admin'
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('logs server error');
  }
  
}

exports.viewProduct = async (req, res) => {
  const product = await Product.findById({ 
    _id: req.params.id,
    $or: [
        { user: req.user._id },
        { user: req.user.adminId }
    ]
  })
  .populate('category')
  .lean();
  const products = await Product.find({})
    .populate('category')
    .exec();
  const categories = await Category.find({
    $or: [
      { user: req.user._id },
      { user: req.user.adminId }
    ]
   })
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
        username: req.user.displayName,
        role: req.user.role,
        showNavbar: true,
        layout: '../views/layouts/admin'
      });
    } else {
      res.send("cannot find product")
    };
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
      username: req.user.displayName,
      role: req.user.role,
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
        username: req.user.displayName,
        role: req.user.role,
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
        username: req.user.displayName,
        role: req.user.role,
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

exports.viewAccount = async (req, res) => {
  try {
    // Fetch the specific user by ID
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).send('User not found');
    }

    res.render('admin/view-user', {
      username: req.user.firstName,
      userID: req.params.id, // Ensure this is passed correctly
      user, // Pass the specific user object
      currentPath: req.path,
      companyname: req.user.companyName,
      username: req.user.username,
      role: req.user.role,
      showNavbar: true,
      layout: '../views/layouts/admin'
    });
  } catch (error) {
    console.log("error:", error);
    return res.status(500).send("Error fetching user details");
  }
}

exports.addUserDetails = async (req, res) => {
  res.render('admin/create-user', {
    username: req.user.displayName,
    currentPath: req.path,
    companyname: req.user.companyName,
    username: req.user.displayName,
    role: req.user.role,
    showNavbar: true,
    layout: '../views/layouts/admin'
  });
}

// PUT/UPDATE
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).where({ user: req.user.id });
    if (!product) return res.status(404).send("Product not found")

    let updatedImage = product.image;
    let logs = [];
    const user = req.user.displayName || req.user.firstName || req.user.companyName || 'Unknown User';

    // Compare and log changes
    if (req.body.name && req.body.name !== product.name) {
      logs.push({ action: 'updateName', productName: product.name, newValue: req.body.name });
    }
    if (req.body.category && req.body.category !== String(product.category)) {
      const categoryDoc = await Category.findById(req.body.category);
      newCategoryName = categoryDoc ? categoryDoc.name : req.body.category;
      logs.push({ action: 'updateCategory', productName: product.name, newValue: newCategoryName });
    }
    if (req.body.price && req.body.price != product.price) {
      logs.push({ action: 'updatePrice', productName: product.name, newValue: req.body.price });
    }
    if ((req.body.quantity || req.body.quantity === 0) && req.body.quantity != product.quantity) {
      logs.push({ action: 'updateQuantity', productName: product.name, newValue: req.body.quantity });
    }
    if (req.file) {
      updatedImage = req.file.path;
      logs.push({ action: 'updateImage', productName: product.name, newValue: path.basename(updatedImage) });
      // Optionally delete old image...
    }

    if (req.file) {
      updatedImage = req.file.path;
      
      if (product.image && product.image !== '/img/cafe-latter.jpg' && product.image !== '/img/default-image.jpg') {
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
        quantity: req.body.quantity || null,
        image: updatedImage
      }
    ).where({ user: req.user.id });

    for (const log of logs) {
      await saveProductLog({
        ...log,
        user,
        comment: req.body.comment || '',
        category: req.body.category
      });
    }

    req.flash('success_msg', `A product successfully updated!`);
    res.redirect('/pos/admin/product');
  } catch (error) {
    console.log("error", error)
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

    req.flash('success_msg', `Discount successfully updated!`);
    res.redirect('/pos/admin/discount');
  } catch (error) {
    console.log("error", error)
  }
}

exports.updateAccount = async (req, res) => {
  try{
    await User.findOneAndUpdate(
      { _id: req.params.id },
      {
        emailAddress: req.body.emailAddress,
        displayName: req.body.displayName,
        role: req.body.role
      }
    )

    req.flash('success_msg', `Account successfully updated!`);
    res.redirect('/pos/admin/account');
  } catch (error) {
    console.log("error", error)
    res.render('error in update account')
  }
}

// DELETE
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).where({ user: req.user.id });
    if (product) {
      await saveProductLog({
        action: 'delete',
        productName: product.name,
        user: req.user.displayName || req.user.firstName || req.user.companyName || 'Unknown User',
        comment: req.body.comment || '',
      });
    }

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

    for (const item of receipt.orderItems) {
      const product = await Product.findById(item.id);

      if (product) {
        product.sold = product.sold - item.quantity >= 0 ? product.sold - item.quantity : 0; // Prevent negative sold count

        if (product.quantity !== null) {
          product.quantity += item.quantity;
        }

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

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if(!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Delete the user
    await User.findByIdAndDelete(req.params.id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: 'Server error in delete user' });
  }
}

// POST / ADD
exports.newProduct = async (req, res) => {
  const { name, category, price, quantity, newCategory, categoryDescription, trackQuantity, comment } = req.body;

  const defaultImage = '/img/default-image.jpg';
  const image = req.file ? req.file.path : defaultImage;

  try {

    const existingProduct = await Product.findOne({
      user: req.user._id,
      name: { $regex: `^${name}$`, $options: 'i' }
    });

    if (existingProduct) {
      // If AJAX, send JSON; else, set flash and redirect
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(400).json({ duplicate: true, message: 'Product name already exists.' });
      } else {
        req.flash('error_msg', 'Product name already exists.');
        return res.redirect('/pos/admin/product');
      }
    }

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
      quantity: trackQuantity === "on" ? quantity || 0 : null, // If tracking is off, set quantity to null
      image,
      sold,
    });
    await newProduct.save();

    await saveProductLog({
      action: 'create',
      productName: name,
      user: req.user.displayName || req.user.firstName || req.user.companyName || 'Unknown User',
      comment: comment,
      category: categoryID
    });
    
    req.flash('success_msg', `"${name}" successfully added!`);
    res.redirect('/pos/admin/product');

  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'An error occurred while creating the product.');
    res.redirect('/pos/admin/product');
  }
}

exports.checkProductDuplicate = async (req, res) => {
  const { name } = req.body;
  const existingProduct = await Product.findOne({
    user: req.user._id,
    name: { $regex: `^${name}$`, $options: 'i' }
  });
  if (existingProduct) {
    return res.json({ duplicate: true });
  }
  return res.json({ duplicate: false });
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

exports.createUser = async (req, res) => {
  const { emailAddress, displayName, password, confirmPassword, role } = req.body;

  // Validation: Check for missing fields
  if (!emailAddress || !displayName || !password || !confirmPassword || !role) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required.',
    });
  }

  // Validation: Check if passwords match
  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match.',
    });
  }

  try {
    // Check if the email or username already exists
    const existingUser = await User.findOne({
      $or: [
        { emailAddress: { $regex: `^${emailAddress}$`, $options: 'i' } },
        { displayName: { $regex: `^${displayName}$`, $options: 'i' } },
      ],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email or username already in use.',
      });
    }

    // Hash the password and create the new user
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      emailAddress,
      displayName,
      password: hashedPassword,
      role,
      companyName: req.user.companyName,
      adminId: req.user._id,
    });

    await newUser.save();

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'User created successfully!',
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while creating the user.',
    });
  }
};