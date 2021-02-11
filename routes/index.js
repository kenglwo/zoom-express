const express = require('express');
const router = express.Router();

router.get('/', function(req, res, next) {
  // res.render('index', { title: 'Express' });
  const path = path.join(__dirname, 'public', 'index.html')
  res.sendFile(path)
});

router.post('/', function(request, response) {
    console.log(request.body);
});

module.exports = router;