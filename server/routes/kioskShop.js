const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/checkAuth');
const kioskShopController= require('../controllers/kioskShopController');

router.get('/:accountId/kiosk-shop', kioskShopController.kioskShop);

router.get('/:accountId/kiosk-shop/allProducts', kioskShopController.allProducts);

router.post('/kiosk-shop/orders/:accountId', kioskShopController.orders);

router.get('/:accountId/kiosk-shop/orders/generate-order-number', kioskShopController.generateOrderNumber);

router.post('/:accountId/kiosk-shop/orders/validate-quantities', kioskShopController.validateOrderQuantities);

router.post('/create-paypal-order', kioskShopController.createPaypalOrder);

router.post('/capture-paypal-order', kioskShopController.capturePaypalOrder);

router.post('/api/kiosk/paypal/qr-order', kioskShopController.createQrPaypalOrder);

// router.get('/kiosk/expired', (req, res) => {
//     res.render('kiosk/expired', { layout: false });
// });

module.exports = router;