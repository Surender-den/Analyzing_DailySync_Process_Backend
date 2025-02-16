const express = require('express');
const AmazonIndiaController = require('../controllers/AmazonIndiaController');

const router = express.Router();

router.get('/amazon-india', AmazonIndiaController);

module.exports = router;
