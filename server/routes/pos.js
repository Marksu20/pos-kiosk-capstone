const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/checkAuth');
const { checkRole } = require('../middleware/checkRole');
const posController = require('../controllers/posController');

// pos routes

router.get('/pos', isLoggedIn, checkRole(['admin', 'sub-admin', 'cashier']), posController.pos);
router.get('/pos/order-notif', checkRole(['admin', 'sub-admin', 'cashier']), isLoggedIn, posController.orderNotif);

router.get('/pos/order', isLoggedIn, checkRole(['admin', 'sub-admin', 'cashier']), posController.order);
router.get('/pos/order/order-count', checkRole(['admin', 'sub-admin', 'cashier']), isLoggedIn, posController.orderCount);

router.get('/pos/receipt', isLoggedIn, checkRole(['admin', 'sub-admin', 'cashier']), posController.receipt);

router.get('/pos/check-quantities', isLoggedIn, posController.checkQuantities);

router.post('/pos/confirm-payment', isLoggedIn, posController.confirmPayment);

router.get('/orders/:id', isLoggedIn, checkRole(['admin', 'sub-admin', 'cashier']), isLoggedIn, posController.viewOrder);

router.put('/orders/:id', isLoggedIn, checkRole(['admin', 'sub-admin', 'cashier']), isLoggedIn, posController.updateOrder);

router.put('/orders/:id/to-serve', checkRole(['admin', 'sub-admin', 'cashier']), isLoggedIn, posController.toServe);

router.put('/orders/:id/mark-done', checkRole(['admin', 'sub-admin', 'cashier']), isLoggedIn, posController.markOrderAsDone);

// DELETE
router.delete('/delete-order/:id', isLoggedIn, posController.deleteOrder)

router.delete('/receipts/:id', isLoggedIn, posController.deleteReceipt)

module.exports = router;