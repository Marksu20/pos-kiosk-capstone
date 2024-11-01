const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/checkAuth');
const kioskController = require('../controllers/kioskController');

router.get('/kiosk', kioskController.kiosk);

router.get('/kiosk/allProducts', kioskController.allProducts);

router.post('/kiosk/orders', kioskController.orders);

router.get('/kiosk/orders/generate-order-number', kioskController.generateOrderNumber);

module.exports = router;