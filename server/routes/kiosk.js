const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/checkAuth');
const kioskController = require('../controllers/kioskController');

router.get('/kiosk', isLoggedIn, kioskController.kiosk);

router.get('/kiosk/allProducts', isLoggedIn, kioskController.allProducts);

router.get('/kiosk/cart', isLoggedIn, kioskController.cart);

router.post('/kiosk/orders', isLoggedIn, kioskController.orders);

module.exports = router;