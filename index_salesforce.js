var extension = require('lambda-integrator-extension')
var functions = require('./diy_salesforce')

var options = { diy: functions }
exports.handler = extension.createHandler(options)
