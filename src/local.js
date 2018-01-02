var express = require('express')
var serveStatic = require('serve-static')
var path = require('path');

var app = express()

console.log(path.join(__dirname, '..', 'cache'))
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
})
app.use('/cache', serveStatic(path.join(__dirname, '..', 'cache')))
app.listen(3000)
