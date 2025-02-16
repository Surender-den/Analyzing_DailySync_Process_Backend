
const AjioController = require('./controllers/AjioController');
const AmazonIndiaController = require('./controllers/AmazonIndiaController');
const AmazonVCPController = require('./controllers/AmazonVCPController');
const FlipkartController = require('./controllers/FlipkartController');
const MeeshoController = require('./controllers/MeeshoController');
const ShopifyController = require('./controllers/ShopifyController');
(async () => {
  console.log('Processing Amazon-India stats...');
  await AmazonIndiaController();

  console.log('Processing Flipkart stats...');
  await FlipkartController();

  console.log('Processing Meesho stats...');
  await MeeshoController();

  console.log('Processing Shopify stats...');
  await ShopifyController();

  console.log('Processing Ajio stats...');
  await AjioController();

  console.log('Processing AmazonVCP stats...');
  await AmazonVCPController();

  
})();
