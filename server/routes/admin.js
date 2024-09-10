const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/checkAuth');
const { requireAdminPassword } = require('../middleware/requireAdminPassword');
const { reAuth } = require('../middleware/reAuth');
const  adminController = require('../controllers/adminController');
const multer = require('multer');
const path = require('path');
const uploads = multer({ dest: 'public/uploads/' });
// admin routes

// GET
router.get('/pos/admin', isLoggedIn, requireAdminPassword, reAuth, adminController.admin);
router.get('/pos/admin/admin-login',  isLoggedIn, adminController.adminLogin);
router.post('/pos/admin/admin-login', isLoggedIn, adminController.adminEntry);

router.post('/send-remove-pin-link', isLoggedIn, adminController.sendRemovePIN );
router.get('/reset-pin/:token', isLoggedIn, adminController.resetPIN );
router.post('/admin/remove-pin', isLoggedIn, adminController.removePIN );

router.get('/pos/admin/dashboard', isLoggedIn, reAuth, adminController.dashboard);

router.get('/pos/admin/product', isLoggedIn, reAuth, adminController.product);
router.get('/pos/admin/product/:id', isLoggedIn, adminController.viewProduct);

router.get('/pos/admin/category', isLoggedIn, reAuth, adminController.category);
router.get('/pos/admin/category/:id', isLoggedIn, reAuth, adminController.viewCategory);

router.get('/pos/admin/stock', isLoggedIn, reAuth, adminController.stock);
router.get('/pos/admin/stock/:id', isLoggedIn, reAuth, adminController.viewStock);

router.get('/pos/admin/receipt', isLoggedIn, reAuth, adminController.receipt);

router.get('/pos/admin/discount', isLoggedIn, reAuth, adminController.discount);
router.get('/pos/admin/discount/:id', isLoggedIn, reAuth, adminController.viewDiscount);

router.get('/pos/admin/account', isLoggedIn, reAuth, adminController.account);

// PUT
router.put('/pos/admin/product/:id', uploads.single('image'), isLoggedIn, adminController.updateProduct);

router.put('/pos/admin/category/:id', isLoggedIn, adminController.updateCategory);

router.put('/pos/admin/stock/:id', isLoggedIn, adminController.updateStock);

router.put('/pos/admin/discount/:id', isLoggedIn, adminController.updateDiscount);

router.put('/pos/admin/account/:id', isLoggedIn, adminController.updateAccount);

// DELETE
router.delete('/pos/admin/delete-product/:id', isLoggedIn, adminController.deleteProduct);

router.delete('/pos/admin/delete-category/:id', isLoggedIn, adminController.deleteCategory);

router.delete('/pos/admin/delete-stock/:id', isLoggedIn, adminController.deleteStock);

router.delete('/pos/admin/delete-discount/:id', isLoggedIn, adminController.deleteDiscount);

// POST
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
var upload = multer({ storage: storage });
router.post('/pos/admin/newProduct', upload.single('image'), isLoggedIn, adminController.newProduct);

router.post('/pos/admin/newCategory', isLoggedIn, adminController.newCategory);

router.post('/pos/admin/newStock', isLoggedIn, adminController.newStock);

router.post('/pos/admin/newDiscount', isLoggedIn, adminController.newDiscount);

module.exports = router;