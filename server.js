var logger = require('winston');
var WinstonDailyRotateFile = require('winston-daily-rotate-file');
var expressIntegratorExtension = require('integrator-extension').express;
var diy = require('./diy');
var process = require('process');

var consoleTransportOpts = {
    colorize: true,
    timestamp: true,
    prettyPrint: true
};

var fileTransportOpts = {
    filename: './server.log',
    maxsize: 10000000,
    maxFiles: 2,
    json: false,
    handleExceptions: true
};

logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, consoleTransportOpts);
logger.add(WinstonDailyRotateFile, fileTransportOpts);

var options = {
    port: 80,
    systemToken: process.env.INTEGRATOR_EXTENSION_SYSTEM_TOKEN,
    diy: diy
};

expressIntegratorExtension.createServer(options, function (err) {
    if (err) {
        logger.error('Failed to create express integrator extension server: ', err.message);
        process.exit(1);
    }
});
