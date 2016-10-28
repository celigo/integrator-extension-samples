'use strict'

var logger = require('winston')
var async = require('async')
var request = require('request')

var HERCULES_URL = 'http://api.integrator.io'

var obj = {
  hooks: {
    preMapFunction: function (options, callback) {
      logger.info('preMapFunction, options: ' + JSON.stringify(options))

      var data = options.data
      var resp = []
      var record

      for (var i = 0; i < data.length; i++) {
        if (data[i].errors) {
          record = { errors: data[i].errors }
        } else if (data[i].warning) {
          record = { errors: [{ code: 'warning', message: 'warning message' }], data: data[i] }
          record.data.id += '-warning'
        } else {
          data[i].processedPreMap = true
          record = { data: data[i] }
        }
        resp.push(record)
      }
      return callback(null, resp)
    },

    preSaveForAttch: function (options, callback) {
      logger.info('preSaveForAttch, options: ' + JSON.stringify(options))
      var exportId = options._exportId
        // preparing request object to fetch the export object. Through this object we will get the connectionId
      var paramToFetchExportForConnection = {
        'url': HERCULES_URL + '/v1/exports/' + exportId,
        'method': 'GET',
        headers: { 'content-Type': 'application/json' },
        auth: { bearer: options.bearerToken }
      }
      logger.info('paramToFetchExportForConnection: ' + JSON.stringify(paramToFetchExportForConnection))

      // Making the request to IO to return the export object

      request(paramToFetchExportForConnection, function (err, response, body) {
        if (err) { return callback(err) }

        var connectionId = JSON.parse(body)._connectionId

        logger.info('body: ' + JSON.stringify(body))
        logger.info('connectionId: ' + connectionId)

        var resultArrayWithBlobsAndMetadata = []

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
          logger.info('preSaveForAttch, paramForReqesutToCreateBlob: ' + JSON.stringify(paramForReqesutToCreateBlob))

          // Making the request to IO. The IO should send the blobs for the exported file items.
          request(paramForReqesutToCreateBlob, function (err, response, body) {
            if (err) { return localcallback(err) }
            logger.info('preSaveForAttch, response: ' + JSON.stringify(response))

            if (body.blobKey) {
              value.blobKey = body.blobKey
            }
            resultArrayWithBlobsAndMetadata[key] = value
            logger.info('value: ' + JSON.stringify(value))

            return localcallback()
          })
        }, function (err) {
          if (err) { return callback(err) }
          logger.info('resultArrayWithBlobsAndMetadata', JSON.stringify(resultArrayWithBlobsAndMetadata))
          return callback(null, { data: resultArrayWithBlobsAndMetadata, errors: options.errors })
        })
      })
    },

    postSubmitAttch: function (options, callback) {
      var data = options.responseData
      var importId = options._importId
      var preMapData = options.preMapData

      logger.info('postSubmitAttch, options: ' + JSON.stringify(options))
        // preparing request object to fetch the import object. Through this object we will get the connectionId

      var paramToFetchImportForConnection = {
        'url': HERCULES_URL + '/v1/imports/' + importId,
        'method': 'GET',
        headers: { 'content-Type': 'application/json' },
        auth: { bearer: options.bearerToken }
      }
      logger.info('paramToFetchImportForConnection: ' + JSON.stringify(paramToFetchImportForConnection))

      // Make the requst to IO. The IO should return the Import object containing the connectionId

      request(paramToFetchImportForConnection, function (err, response, body) {
        if (err) { return callback(err) }
        logger.info('response: ' + JSON.stringify(response))

        var connectionId = JSON.parse(body)._connectionId
        logger.info('connectionId: ' + connectionId)

        var result = []

        async.forEachOf(preMapData, function (value, key, localcallback) {
          var resp = {}
          resp.statusCode = data[key].statusCode

          if (value.id) {
            resp.id = value.id + '-postSubmit'
          } else if (value.postSubmitErrors) {
            resp.errors = value.postSubmitErrors
          } else if (value.errors) {
            resp.errors = value.errors
          }

          result[key] = resp

          if (!value.blobKey) { return localcallback() }

          var json = {
            import: {
              blobKey: value.blobKey,
              salesforce: { operation: 'insert', sObjectType: 'attachment', attachment: { name: data[key].id + '.pdf', parentId: data[key].id, contentType: 'application/pdf' } }
              // salesforce: { operation: 'insert', sObjectType: 'document', document: { name: data[key].id + '.pdf', folderId: 'myfolder' } }
            },
            data: {}
          }

          var paramForImportWithBlob = {
            url: HERCULES_URL + '/v1/connections/' + connectionId + '/import',
            method: 'POST',
            headers: { 'content-Type': 'application/json' },
            auth: { bearer: options.bearerToken },
            json: json
          }
          logger.info('preSaveForAttch, paramForImportWithBlob: ' + JSON.stringify(paramForImportWithBlob))

          // Making import request on IO. The request should download file corresponding to the blob on the import side.
          request(paramForImportWithBlob, function (err, response, body) {
            if (err) { return localcallback(err) }
            logger.info('preSaveForAttch, response: ' + JSON.stringify(response))
            result[key].data = body
            return localcallback()
          })
        }, function (err) {
          if (err) { return callback(err) }
          logger.info('result', JSON.stringify(result))
          return callback(null, { data: result, errors: options.errors })
        })
      })
    }
  }
}

module.exports = obj
