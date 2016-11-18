'use strict'

var _ = require('lodash')
var logger = require('winston')
var async = require('async')
var request = require('request')

var HERCULES_URL = 'https://api.integrator.io'

var obj = {

  hooks: {

    NSpreSaveForAttch: function (options, callback) {
      logger.info('NSpreSaveForAttch, options: ' + JSON.stringify(options))

      var connectionId = options._connectionId
      var resultArrayWithBlobsAndMetadata = []
      var errors = options.errors

      // For each record make an export object which should have a json object with type blob property.

      async.forEachOf(options.data, function (value, key, localcallback) {
        var _resourceId = value.attachmentId
        var json = { export: { type: 'blob', netsuite: { internalId: _resourceId } } }

        var paramForReqesutToCreateBlob = {
          url: HERCULES_URL + '/v1/connections/' + connectionId + '/export',
          method: 'POST',
          headers: { 'content-Type': 'application/json' },
          auth: { bearer: options.bearerToken },
          json: json
        }

        logger.info('NSpreSaveForAttch, paramForReqesutToCreateBlob: ' + JSON.stringify(paramForReqesutToCreateBlob))

        // Making the request to IO. The IO should send the blobs for the exported file items.

        request(paramForReqesutToCreateBlob, function (err, response, body) {
          var error
          if (err) {
            error = { statusCode: 422, errors: [{ code: err.name, message: err.message }] }
            errors.push(error)
            return localcallback()
          }
          logger.info('NSpreSaveForAttch, response: ' + JSON.stringify(response))

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
        logger.info('resultArrayWithBlobsAndMetadata', JSON.stringify(resultArrayWithBlobsAndMetadata))
        return callback(null, { data: resultArrayWithBlobsAndMetadata, errors: errors })
      })
    },

    NSpostSubmitAttch: function (options, callback) {
      logger.info('NSpostSubmitAttch, options: ' + JSON.stringify(options))

      var data = options.responseData
      var preMapData = options.preMapData
      var connectionId = options._connectionId
      var result = []
      var errors = []

      async.forEachOf(data, function (value, key, localcallback) {
        if (value.statusCode !== 200) {
          errors.push(value)
          return localcallback()
        }

        var netsuite = { operation: 'addupdate', file: { name: data[key].id + '.pdf', folder: '9858' } }
        var json = { import: { blobKey: preMapData[key].blobKey, netsuite: netsuite }, data: {} }

        var paramForImportWithBlob = {
          url: HERCULES_URL + '/v1/connections/' + connectionId + '/import',
          method: 'POST',
          headers: { 'content-Type': 'application/json' },
          auth: { bearer: options.bearerToken },
          json: json
        }
        logger.info('NSpostSubmitAttch, paramForImportWithBlob: ' + JSON.stringify(paramForImportWithBlob))

        // Making import request on IO. The request should download file corresponding to the blob on the import side.
        request(paramForImportWithBlob, function (err, response, body) {
          var error
          if (err) {
            error = { statusCode: 422, errors: [{ code: err.name, message: err.message }] }
            errors.push(error)
            return localcallback()
          }
          logger.info('NSpostSubmitAttch, response: ' + JSON.stringify(response))
          if (response.statusCode !== 200) {
            error = { statusCode: response.statusCode, errors: body.errors }
            errors.push(error)
            return localcallback()
          }
          result.push(body)
          return localcallback()
        })
      }, function () {
        logger.info('result', JSON.stringify(result))

        var recordAndFile = []
        _.forEach(result, function (value, key) {
          if (value.netsuite.isSuccess) {
            var record = { fileRecordType: 'file', recordType: 'salesorder', fileId: value.netsuite.id, recordId: data[key].id }
            recordAndFile.push(record)
          }
        })
        logger.info('NSpostSubmitAttch, recordAndFile: ' + JSON.stringify(recordAndFile))

        var paramForProxyCallToGetResponse = {
          url: HERCULES_URL + '/v1/connections/' + connectionId + '/proxy',
          method: 'POST',
          headers: {
            'content-Type': 'application/json',
            'integrator-method': 'POST',
            'integrator-netSuite-scriptId': 'customscript1434',
            'integrator-netSuite-deployId': 'customdeploy1'
          },
          auth: { bearer: options.bearerToken },
          json: { data: recordAndFile }
        }
        logger.info('NSpostSubmitAttch, paramForProxyCallToGetResponse: ' + JSON.stringify(paramForProxyCallToGetResponse))

        request(paramForProxyCallToGetResponse, function (err, response, body) {
          if (err) return callback(err)
          logger.info('NSpostSubmitAttch, response: ' + JSON.stringify(response))
          var result = body.concat(errors)
          return callback(null, result)
        })
      })
    }
  }
}

module.exports = obj
