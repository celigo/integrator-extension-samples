'use strict'

var logger = require('winston')
var async = require('async')
var request = require('request')

// var HERCULES_URL = 'https://api.integrator.io'
var HERCULES_URL = 'https://api.staging.integrator.io'

var obj = {

  hooks: {

    SFpreSaveForAttch: function (options, callback) {
      logger.info('SFpreSaveForAttch, options: ' + JSON.stringify(options))

      var connectionId = options._connectionId
      var resultArrayWithBlobsAndMetadata = []
      var errors = options.errors

      // For each record make an export object which should have a json object with type blob property.

      async.forEachOf(options.data, function (value, key, localcallback) {
        var _resourceId = value.Attachments[0].Id
        var _resourceType = value.Attachments[0].attributes.type
        var json = { export: { type: 'blob', salesforce: { sObjectType: _resourceType, id: _resourceId } } }

        var paramForReqesutToCreateBlob = {
          url: HERCULES_URL + '/v1/connections/' + connectionId + '/export',
          method: 'POST',
          headers: { 'content-Type': 'application/json' },
          auth: { bearer: options.bearerToken },
          json: json
        }

        logger.info('SFpreSaveForAttch, paramForReqesutToCreateBlob: ' + JSON.stringify(paramForReqesutToCreateBlob))

        // Making the request to IO. The IO should send the blobs for the exported file items.
        request(paramForReqesutToCreateBlob, function (err, response, body) {
          var error
          if (err) {
            error = { statusCode: 422, errors: [{ code: err.name, message: err.message }] }
            errors.push(error)
            return localcallback()
          }
          logger.info('SFpreSaveForAttch, response: ' + JSON.stringify(response))

          if (response.statusCode !== 200) {
            error = { statusCode: 422, errors: body.errors }
            errors.push(error)
            return localcallback()
          }

          value.blobKey = body.blobKey
          resultArrayWithBlobsAndMetadata.push(value)

          return localcallback()
        })
      }, function () {
        logger.info('SFpreSaveForAttch, resultArrayWithBlobsAndMetadata', JSON.stringify(resultArrayWithBlobsAndMetadata))
        return callback(null, { data: resultArrayWithBlobsAndMetadata, errors: errors })
      })
    },

    SFpostSubmitAttch: function (options, callback) {
      logger.info('SFpostSubmitAttch, options: ' + JSON.stringify(options))

      var data = options.responseData
      var connectionId = options._connectionId
      var preMapData = options.preMapData
      var result = []

      async.forEachOf(data, function (value, key, localcallback) {
        if (value.statusCode !== 200) {
          result.push(value)
          return localcallback()
        }
        var attachment = { name: value.id + '.pdf', parentId: value.id, contentType: 'application/pdf' }
        var salesforce = { operation: 'insert', sObjectType: 'attachment', attachment: attachment }
        var json = { import: { blobKey: preMapData[key].blobKey, salesforce: salesforce }, data: {} }

        var paramForImportWithBlob = {
          url: HERCULES_URL + '/v1/connections/' + connectionId + '/import',
          method: 'POST',
          headers: { 'content-Type': 'application/json' },
          auth: { bearer: options.bearerToken },
          json: json
        }
        logger.info('SFpostSubmitAttch, paramForImportWithBlob: ' + JSON.stringify(paramForImportWithBlob))

        // Making import request on IO. The request should download file corresponding to the blob on the import side.
        request(paramForImportWithBlob, function (err, response, body) {
          var error
          if (err) {
            error = { statusCode: 422, errors: [{ code: err.name, message: err.message }] }
            result.push(error)
            return localcallback()
          }
          logger.info('SFpostSubmitAttch, response: ' + JSON.stringify(response))
          if (response.statusCode !== 200) {
            error = { statusCode: response.statusCode, errors: body.errors }
            result.push(error)
            return localcallback()
          }
          result.push(value)
          return localcallback()
        })
      }, function () {
        logger.info('SFpostSubmitAttch, result: ', JSON.stringify(result))
        return callback(null, result)
      })
    }
  }
}

module.exports = obj
