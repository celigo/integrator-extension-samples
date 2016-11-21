'use strict'
var _ = require('lodash')
var netsuite = require('./diy_netsuite')
var salesforce = require('./diy_salesforce')
var mysql = require('./diy_mysql')

var hooks = {}
var wrappers = {}

var getHooksWrappers = function (name) {
  _.forEach(name.wrappers, function (value, key) {
    if (name.wrappers.hasOwnProperty(key)) wrappers[key] = name.wrappers[key]
  })
  _.forEach(name.hooks, function (value, key) {
    if (name.hooks.hasOwnProperty(key)) hooks[key] = name.hooks[key]
  })
}

getHooksWrappers(netsuite)
getHooksWrappers(salesforce)
getHooksWrappers(mysql)

var obj = {
  hooks: hooks,
  wrappers: wrappers
}

module.exports = obj
