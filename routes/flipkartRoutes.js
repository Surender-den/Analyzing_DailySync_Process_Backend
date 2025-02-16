const express = require('express');
const FlipkartController = require('../controllers/FlipkartController');

const router = express.Router();

router.get('/flipkart', FlipkartController);

module.exports = router;
