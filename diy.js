'use strict'

var mysql = require('mysql')
var logger = require('winston')

var wrappers = {

  processExport: function (options, callback) {

  },

  processMySQLPing: function (options, callback) {
    logger.info('options', options)
    return callback(new Error('Not Implemented Yet'))
  },

  processMySQLImport: function (options, callback) {
    var host, user, database, password, query

    logger.info('options', options)

    if (!options) {
      return callback(new Error('!options'))
    }

    if (!options.connection || !options.connection.unEncrypted || !options.connection.encrypted) {
      return callback(new Error('!options.connection || !options.connection.unEncrypted || !options.connection.encrypted'))
    }
    host = options.connection.unEncrypted.host
    user = options.connection.unEncrypted.user
    database = options.connection.unEncrypted.database
    password = options.connection.encrypted.password

    if (!options.configuration || !options.configuration.query) {
      return callback(new Error('!options.configuration || !options.configuration.query'))
    }
    query = options.configuration.query

    var connection = mysql.createConnection({
      host: host,
      user: user,
      password: password,
      database: database
    })

    if (!Array.isArray(options.postMapData) || options.postMapData.length < 1) {
      return callback(new Error('!Array.isArray(options.postMapData) || options.postMapData.length < 1'))
    }

    connection.connect(function (err) {
      if (err) {
        return callback(err)
      }
      var query = connection.query(query, options.postMapData, function (err, results) {
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

function getMySQLConnection (options) {

}

exports.wrappers = wrappers
