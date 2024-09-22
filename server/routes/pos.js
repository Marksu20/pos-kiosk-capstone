const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/checkAuth');
const posController = require('../controllers/posController');

// pos routes

router.get('/pos', isLoggedIn, posController.pos);
router.get('/pos/order-notif', isLoggedIn, posController.orderNotif);

router.get('/pos/order', isLoggedIn, posController.order);
router.get('/pos/order/order-count', isLoggedIn, posController.orderCount);

router.get('/pos/receipt', isLoggedIn, posController.receipt);

router.post('/pos/confirm-payment', isLoggedIn, posController.confirmPayment);

router.get('/orders/:id', isLoggedIn, posController.viewOrder);
router.put('/orders/:id', isLoggedIn, posController.updateOrder);
router.put('/orders/:id/served', isLoggedIn, posController.served);

// DELETE
router.delete('/delete-order/:id', isLoggedIn, posController.deleteOrder)

router.delete('/receipts/:id', isLoggedIn, posController.deleteReceipt)

module.exports = router;