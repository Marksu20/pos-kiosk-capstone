const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/checkAuth');
const kioskController = require('../controllers/kioskController');

router.get('/:accountId/kiosk', kioskController.kiosk);

router.get('/:accountId/kiosk/allProducts', kioskController.allProducts);

router.post('/kiosk/orders/:accountId', kioskController.orders);

router.get('/:accountId/kiosk/orders/generate-order-number', kioskController.generateOrderNumber);

module.exports = router;