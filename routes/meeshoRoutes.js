const express = require('express');
const MeeshoController = require('../controllers/MeeshoController');

const router = express.Router();

router.get('/meesho', MeeshoController);

module.exports = router;
