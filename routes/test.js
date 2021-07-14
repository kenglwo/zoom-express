const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');
const { render } = require('../app');
require('dotenv').config()



router.get('/', function(req, res, next) {
  const num = Math.floor((Math.random() * 10) + 1);
  console.log(num);
  data = {"length": num}
  res.json(data)

});

// router.post('/', function(req, res) {
//     console.log(req.body);
//     const meetingID = req.body.meetingID;
//     const role = req.body.role; 

//     res.send(signature);
// });

// module.exports = function (io) {
//     //Socket.IO
//     io.on('connection', function (socket) {
//         console.log('User has connected to Index');

//         socket.on('message',function(msg){
//           console.log('message: ' + msg);
//           io.emit('message', msg);
//         });
//     });
//     return router;
// };

module.exports = router;