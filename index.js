var extension = require('lambda-integrator-extension')
var functions = require('./src/diy')

var options = { diy: functions }
exports.handler = extension.createHandler(options)
