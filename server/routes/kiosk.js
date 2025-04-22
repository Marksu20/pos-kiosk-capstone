const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/checkAuth');
const kioskController = require('../controllers/kioskController');

router.get('/:accountId/kiosk', kioskController.kiosk);

router.get('/:accountId/kiosk/allProducts', kioskController.allProducts);

router.post('/kiosk/orders/:accountId', kioskController.orders);

router.get('/:accountId/kiosk/orders/generate-order-number', kioskController.generateOrderNumber);

router.post('/create-paypal-order', kioskController.createPaypalOrder);

router.post('/capture-paypal-order', kioskController.capturePaypalOrder);


module.exports = router;