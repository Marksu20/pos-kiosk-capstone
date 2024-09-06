const express = require('express');
const router = express.Router();
const mainController = require('../controllers/mainController');

// idnex routes
router.get('/', mainController.signin);

router.get('/signup', mainController.signup);

module.exports = router;