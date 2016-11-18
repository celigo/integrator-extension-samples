var logger = require('winston')
var expressIntegratorExtension = require('express-integrator-extension')
var diy = require('./src/diy')

var port = 80
var systemToken = process.env.INTEGRATOR_EXTENSION_SYSTEM_TOKEN

var options = {
  port: port,
  systemToken: systemToken,
  diy: diy
}

console.log(options)
expressIntegratorExtension.createServer(options, function (err) {
  if (err) {
    logger.error('Failed to create express integrator extension server: ', err.message)
    process.exit(1)
  }
})
