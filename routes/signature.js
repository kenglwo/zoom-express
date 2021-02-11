const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');
const { render } = require('../app');
require('dotenv').config()


function generateSignature(apiKey, apiSecret, meetingNumber, role) {

  // Prevent time sync issue between client signature generation and zoom 
  const timestamp = new Date().getTime() - 30000
  const msg = Buffer.from(apiKey + meetingNumber + timestamp + role).toString('base64')
  const hash = crypto.createHmac('sha256', apiSecret).update(msg).digest('base64')
  const signature = Buffer.from(`${apiKey}.${meetingNumber}.${timestamp}.${role}.${hash}`).toString('base64')

  return signature
}

router.get('/', function(req, res, next) {
  // pass in your Zoom JWT API Key, Zoom JWT API Secret, Zoom Meeting Number, and 0 to join meeting or webinar or 1 to start meeting
  const signature = generateSignature(process.env.API_KEY, process.env.API_SECRET, 123456789, 0)
  console.log(generateSignature(process.env.API_KEY, process.env.API_SECRET, 123456789, 0))
  render.send(signature);

  // const url = path.join(__dirname, "..", 'public', 'index.html')
  // res.sendFile(url)
  // res.render('index')
});

router.post('/', function(req, res) {
    console.log(req.body);
    const meetingID = req.body.meetingID;
    const role = req.body.role; // 0:host, 1:participant

    // pass in your Zoom JWT API Key, Zoom JWT API Secret, Zoom Meeting Number, and 0 to join meeting or webinar or 1 to start meeting
    const signature = generateSignature(process.env.API_KEY, process.env.API_SECRET, meetingID, role)
    console.log(generateSignature(process.env.API_KEY, process.env.API_SECRET, 123456789, 0))

    res.send(signature);
});

module.exports = function (io) {
    //Socket.IO
    io.on('connection', function (socket) {
        console.log('User has connected to Index');

        socket.on('message',function(msg){
          console.log('message: ' + msg);
          io.emit('message', msg);
        });
    });
    return router;
};