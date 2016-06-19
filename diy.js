'use strict'

var util = require('util')
var mysql = require('mysql')
var logger = require('winston')

var wrappers = {

  pingMySQLConnection: function (options, callback) {
    // getMySQLConnectionHelper will implicitly test the ability to connect,
    // and return an error if connect fails.
    getMySQLConnectionHelper(options, function (err, connection) {
      if (err) {
        return callback(null, {
          statusCode: 401,
          errors: [{code: err.code, message: util.inspect(err, {depth: null})}]
        })
      }
      connection.end(function (err) {
        if (err) {
          logger.error('connection.end', util.inspect(err, {depth: null}))
          return callback(err)
        }
        return callback(null, {statusCode: 200})
      })
    })
  },

  processMySQLExport: function (options, callback) {
    if (!options.configuration || !options.configuration.query) {
      return callback(new Error('!options.configuration || !options.configuration.query'))
    }
    var query = options.configuration.query
    getMySQLConnectionHelper(options, function(err, connection) {
      if (err) {
        return callback(err)
      }
      connection.query(query, function (err, rows) {
        if (err) {
          return callback(err)
        }
        logger.info('rows', util.inspect(rows, {depth: null}))
        connection.end(function (err) {
          if (err) {
            logger.error('connection.end', util.inspect(err, {depth: null}))
            return callback(err)
          }
          return callback(null, {data: [], lastPage: true})
        })
      })
  },

  processMySQLImport: function (options, callback) {
    if (!options.configuration || !options.configuration.query) {
      return callback(new Error('!options.configuration || !options.configuration.query'))
    }
    var query = options.configuration.query
    if (!Array.isArray(options.postMapData) || options.postMapData.length < 1) {
      return callback(new Error('!Array.isArray(options.postMapData) || options.postMapData.length < 1'))
    }
    getMySQLConnectionHelper(options, function(err, connection) {
      if (err) {
        return callback(err)
      }
      connection.query(query, options.postMapData, function (err, results) {
        if (err) {
          return callback(err)
        }
        if (results.length !== options.postMapData.length) {
          return callback(new Error('results.length !== options.postMapData.length'))
        }
        var toReturn = []
        for (var i = 0; i < results.length; i++) {
          toReturn.push({statusCode: 200, id: results[i].insertId})
        }
        return callback(null, toReturn)
      })
    })
  }
}

function getMySQLConnectionHelper (options, callback) {
  logger.info('options', util.inspect(options, { depth: null }))

  if (!options.connection || !options.connection.unencrypted || !options.connection.encrypted) {
    return callback(new Error('!options.connection || !options.connection.unencrypted || !options.connection.encrypted'))
  }

  var host, user, database, password
  host = options.connection.unencrypted.host
  user = options.connection.unencrypted.user
  database = options.connection.unencrypted.database
  password = options.connection.encrypted.password

  var connection = mysql.createConnection({
    host: host,
    user: user,
    password: password,
    database: database
  })

  connection.connect(function (err) {
    if (err) {
      logger.error('connection.connect', util.inspect(err, {depth: null}))
      return callback(err)
    }
    return callback(null, connection)
  })
}

exports.wrappers = wrappers
