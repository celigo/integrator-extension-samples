'use strict'

var util = require('util');
var mysql = require('mysql');
var logger = require('winston');
var _ = require('lodash');
var async = require('async');

var wrappers = {

    /*--------------------------------------------------------------------------
    ** Function Name    : pingMySQLConnection
    ** Description      : Helper function to test the db connection
    **------------------------------------------------------------------------*/
    pingMySQLConnection: function (options, callback) {

        // getMySQLConnectionHelper will implicitly test the ability to connect,
        // and return an error if connect fails.

        getMySQLConnectionHelper(options, function (err, connection) {
            if (err) {
                return callback(null, {
                    statusCode: 401,
                    errors: [{code: err.code, message: util.inspect(err, {depth: null})}]
                });
            }
            connection.end();
            return callback(null, {statusCode: 200});
        });
    },

    /*--------------------------------------------------------------------------
    ** Function Name    : processMySQLExport
    ** Description      : Export the rows using one of the export type (All,
    **                    once, delta, test). Use the below configuration sample
    **
    **                      {
    **                          "table" : "TABLE_NAME",
    **                          "size" : 2
    **                      }
    **
    **                    Field is the auto incremented col signifying row count
    **                    Size is the number of rows to be exported at a time
    **------------------------------------------------------------------------*/
    processMySQLExport: function (options, callback) {
        if (!options.configuration) {
            return callback(new Error('!options.configuration'));
        }
        if(_.isEmpty(options.configuration.table)){
            return callback(new Error('_.isEmpty(options.configuration.table)'));
        }
        var connection;
        async.waterfall([

            function (cb){
                getMySQLConnectionHelper(options, function (err, conn){
                    if (err) {
                        return cb(err);
                    }
                    connection=conn;
                    return cb(null);
                });
            },

            function (cb){
                getPropertyField(connection, options.configuration.table, 'auto_increment', function(err, results){
                    if(err){
                        return cb(err);
                    }
                    return cb(null,results);
                })
            },

            function (keyField, cb){
                var args=[];
                var type = _.get(options,'type','all');
                var size = _.get(options,'configuration.query.size',100);
                var startIndex = _.get(options,'state.startIndex',0);
                var typeQuery = {
                    'all': ' select * from ?? where ?? > ? ',
                    'once': ' and ?? = 0 ',
                    'delta': ' and ?? > ? ',
                    'test': ' limit 1 ',
                    'suffix': ' order by ?? limit ? ',
                    'update': 'update ?? set ??=1 where ?? in ? '
                }

                var query=typeQuery.all;
                args.push(options.configuration.table);
                args.push(keyField);
                args.push(startIndex);

                switch (type) {

                    case 'all':
                    query += typeQuery.suffix;
                    args.push(keyField);
                    args.push(size);
                    break;

                    case 'once':
                    if(_.isEmpty(options.once.booleanField)){
                        return cb(new Error('_.isEmpty(options.once.booleanField)'));
                    }
                    query += typeQuery.once;
                    query += typeQuery.suffix;
                    args.push(options.once.booleanField);
                    args.push(keyField);
                    args.push(size);
                    break;

                    case 'delta':
                    if(_.isEmpty(options.delta.dateField)){
                        return cb(new Error('_.isEmpty(options.delta.dateField)'));
                    }
                    query += typeQuery.delta;
                    query += typeQuery.suffix;
                    args.push(options.delta.dateField);
                    args.push(new Date(options.delta.lastExecutionTime));
                    args.push(keyField);
                    args.push(size);
                    break;

                    case 'test':
                    query += typeQuery.test;
                    break;

                    default:
                    return cb(new Error('default'));
                }

                query = connection.format(query,args);
                connection.query(query, function (err, rows) {
                    if (err) {
                        logger.error('connection.query', util.inspect(err, {depth: null}));
                        return cb(err);
                    }
                    var data = JSON.parse(JSON.stringify(rows));
                    var ids = [];

                    if(_.isEqual(type,'test') || data.length < 1){
                        return cb(null,{data: data, lastPage: true});
                    }

                    if(_.isEqual(type,'delta') || _.isEqual(type,'all')){
                        var lastPage = data.length < size ? true : false;
                        var state = {
                            startIndex : _.last(ids)
                        }
                        return cb(null,{data: data, lastPage: lastPage, state: state });
                    }

                    _.forEach(data,function(value){
                        ids.push(_.get(value,keyField));
                    });

                    query= connection.format(typeQuery.update, [options.configuration.table, options.once.booleanField, keyField, [ids]]);
                    connection.query(query, function(err,rows){
                        if (err) {
                            logger.error('connection.query', util.inspect(err, {depth: null}));
                            return cb(err);
                        }
                        if(rows.changedRows !== ids.length){
                            return cb(new Error('rows.changedRows !== ids.length'));
                        }

                        var lastPage = ids.length < size ? true : false;
                        var state = {
                            startIndex : _.last(ids)
                        }
                        return cb(null,{data: data, lastPage: lastPage, state: state });
                    });
                });
            }],function(err,results){
                if(err){
                    if(connection){
                        connection.destroy();
                    }
                    logger.error('processMySQLExport', util.inspect(err, {depth: null}));
                    return callback(err);
                }
                connection.end();
                return callback(null,results);
            }
        );
    },

    /*--------------------------------------------------------------------------
    ** Function Name    : processMySQLImport
    ** Description      : Import the rows to the db. The supported operations
    **                    are ADD, UPDATE, ADDUPDATE. Below is the sample
    **                    configuration
    **
    **      {
    **          "importType" : "add",
    **          "table" : "TABLE_NAME",
    **          "ignoreExistingRecords" : "false",
    **          "ignoreMissingRecords" : "false",
    **          "existingRecCondition" : {
    **              "condition" : " COL_A = ? and COL_B = ? ",
    **              "colField" : ["COL_C","COL_D"]
    **          }
    **      }
    **
    **      TABLE_NAME is the table on which the import is performed
    **
    **      ignoreExistingRecords(for ADD) when set to false will try to
    **          insert the rows without checking the existing records.
    **
    **      ignoreMissingRecords(for UPDATE) when set to false will not throw
    **          any error when the record to be updated is missing.
    **
    **      existingRecCondition should be configured for all kind of operations
    **          except that of pure INSERT i.e. importType is "ADD" and
    **          ignoreExistingRecords is "true"
    **
    **      condition is used for checking existing records and updating
    **          records. The condition needs to be written in MySql syntax
    **          where COL_A, COL_B represent table columns of import table.
    **
    **      colField COL_C, COL_D are the table columns against which COL_A, COL_B
    **          needs to be checked.
    **
    **      NOTE: Make sure that for all the operations of type ADD, UPDATE,
    **            ADDUPDATE, EXTERNAL_ID of source table is mapped to the
    **            auto_increment key field of destination table.
    **
    **------------------------------------------------------------------------*/
    processMySQLImport: function (options, callback) {
        if (!options.configuration || !options.configuration.importType) {
            return callback(new Error('!options.configuration || !options.configuration.importType'));
        }
        if(!options.configuration.table){
            return callback(new Error('!options.configuration.table'));
        }
        if (!Array.isArray(options.postMapData) || options.postMapData.length < 1) {
            return callback(new Error('!Array.isArray(options.postMapData) || options.postMapData.length < 1'));
        }

        var importType = options.configuration.importType;

        if(!(importType==='add' || importType==='update' || importType==='addUpdate')){
            return callback(new Error('Invalid import type'));
        }

        var connection;

        async.waterfall([
            function(cb){
                getMySQLConnectionHelper(options, function (err, conn) {
                    if (err) {
                        return cb(err);
                    }
                    connection=conn;
                    return cb(null);
                });
            },

            function (cb){
                getPropertyField(connection, options.configuration.table, 'auto_increment', function(err, results){
                    if(err){
                        return cb(err);
                    }
                    if(!_.includes(Object.keys(options.postMapData[0]),results)){
                        return cb(new Error('Key field missing in mapping'));
                    }
                    options.configuration.keyField= results;
                    return cb(null);
                });
            },

            function (cb){
                executeImportType(options, connection, cb);
            }
        ],function(err, results){
            if(err){
                if(connection){
                    connection.destroy();
                }
                return callback(err);
            }
            connection.end();
            callback(null,results);
        });
    }
}

/*--------------------------------------------------------------------------
** Function Name    : executeImportType
** Description      : Identify the type of import and call the relative
**                    functions.
**------------------------------------------------------------------------*/
function executeImportType(options,connection,callback){
    if(options.configuration.importType === 'add'){
        importTypeAdd(options,connection,function(err,results){
            if(err){
                return callback(err);
            }
            return callback(null,results);
        });
    }
    else if (options.configuration.importType === 'update') {
        importTypeUpdate(options,connection,function(err,results){
            if(err){
                return callback(err);
            }
            return callback(null,results);
        });
    }
    else if (options.configuration.importType === 'addUpdate'){
        importTypeAddUpdate(options,connection,function(err,results){
            if(err){
                return callback(err);
            }
            return callback(null,results);
        });
    }
}

/*--------------------------------------------------------------------------
** Function Name    : importTypeAdd
** Description      : Funtion to insert rows. When ignoreExistingRecords is
**                    set to false, it checks for existing row else it
**                    inserts the row into table.
**
**------------------------------------------------------------------------*/
function importTypeAdd(options,connection,callback){
    if(!options.configuration.ignoreExistingRecords){
        return callback(new Error('!options.configuration.ignoreExistingRecords'));
    }
    if(options.configuration.ignoreExistingRecords === 'true'){
        if(!options.configuration.existingRecCondition || !options.configuration.existingRecCondition.condition || !options.configuration.existingRecCondition.colField){
            return callback(new Error('!options.configuration.existingRecCondition || !options.configuration.existingRecCondition.condition || !options.configuration.existingRecCondition.colField'));
        }
        executeSelect(options,connection,function(err,results){
            if(err){
                return callback(err);
            }
            return callback(null,results);
        });
    }
    else if(options.configuration.ignoreExistingRecords === 'false'){
        executeInsert(options,connection,options.postMapData,function(err,results){
            if(err){
                return callback(err);
            }
            return callback(null,results);
        });
    }
    else{
        return callback(new Error('options.configuration.ignoreExistingRecords'));
    }
}

/*--------------------------------------------------------------------------
** Function Name    : importTypeUpdate
** Description      : Funtion to update rows.
**
**------------------------------------------------------------------------*/
function importTypeUpdate(options,connection,callback){
    if(!options.configuration.ignoreMissingRecords){
        return callback(new Error('!options.configuration.ignoreMissingRecords'));
    }
    if(!options.configuration.existingRecCondition || !options.configuration.existingRecCondition.condition || !options.configuration.existingRecCondition.colField){
        return callback(new Error('!options.configuration.existingRecCondition || !options.configuration.existingRecCondition.condition || !options.configuration.existingRecCondition.colField'));
    }
    executeUpdate(options,connection,function(err,results){
        if(err){
            return callback(err);
        }
        return callback(null,results);
    });
}

/*--------------------------------------------------------------------------
** Function Name    : importTypeAddUpdate
** Description      : Funtion to add and update rows.
**
**------------------------------------------------------------------------*/
function importTypeAddUpdate(options,connection,callback){
    if(!options.configuration.existingRecCondition || !options.configuration.existingRecCondition.condition || !options.configuration.existingRecCondition.colField){
        return callback(new Error('!options.configuration.existingRecCondition || !options.configuration.existingRecCondition.condition || !options.configuration.existingRecCondition.colField'));
    }

    executeUpdate(options,connection,function(err,results){
        if(err){
            return callback(err);
        }
        return callback(null,results);
    });

}

/*--------------------------------------------------------------------------
** Function Name    : executeSelect
** Description      : Funtion to identify existing rows. If the row does
**                    not exist then insert the row.
**
**------------------------------------------------------------------------*/
function executeSelect(options,connection,callback){
    var toReturn = [];
    var query = 'select * from ?? where ';
    query += options.configuration.existingRecCondition.condition;

    async.eachOf(options.postMapData, function(dataValue,index,cb){
        var args = [];
        args.push(options.configuration.table);
        _.forEach(options.configuration.existingRecCondition.colField,function(condValue){
            args.push(dataValue[condValue]);
        });
        var tempQuery = connection.format(query,args);
        connection.query(tempQuery,function(err,results) {
            if(err){
                logger.error('executeSelect', util.inspect(err, {depth: null}));
                toReturn[index] = {statusCode:err.errno , id: -1};
                return cb();
            }
            else if(results.length < 1){
                executeInsert(options,connection,[dataValue],function(err,results){
                    if(err){
                        logger.error('executeInsert', util.inspect(err, {depth: null}));
                    }
                    toReturn[index]=results[0];
                    return cb();
                });
            }
            else{
                toReturn[index] = {statusCode:200, id:results[0][options.configuration.keyField]};
                return cb();
            }
        });
    }, function(){
        return callback(null,toReturn);
    });
}

/*--------------------------------------------------------------------------
** Function Name    : executeUpdate
** Description      : Funtion to update the rows. If the row does
**                    not exist then insert the row or throw error based
**                    on the importType and ignoreMissingRecords property.
**
**------------------------------------------------------------------------*/
function executeUpdate(options,connection,callback){
    var ignoreMissingRecords = options.configuration.ignoreMissingRecords;

    if((options.configuration.importType === 'update') && (!(ignoreMissingRecords ==='true' || ignoreMissingRecords === 'false'))){
        return callback(new Error('Invalid value for ignoreMissingRecords'));
    }

    var toReturn=[];
    var keys = Object.keys(options.postMapData[0]);

    var query = 'update '+ options.configuration.table + ' set ';
    _.forEach(keys, function(value){
        query+=value + '=?, ';
    });
    query=_.trimEnd(query,' ,') + ' where ' + options.configuration.existingRecCondition.condition;

    async.eachOf(options.postMapData,function(dataValue,index,cb){
        var args = [];
        _.forEach(keys, function(colValue){
            args.push(dataValue[colValue]);
        });

        _.forEach(options.configuration.existingRecCondition.colField,function(colValue){
            args.push(dataValue[colValue]);
        });

        var tempQuery = connection.format(query,args);
        connection.query(tempQuery,function(err,results){
            if(err){
                logger.error('executeUpdate', util.inspect(err, {depth: null}));
                toReturn[index] = {statusCode:err.errno , id: -1};
                return cb();
            }
            if(results.affectedRows === 0){
                if(options.configuration.importType === 'update' && options.configuration.ignoreMissingRecords === 'true'){
                    logger.error('Missing record: '+tempQuery);
                    toReturn[index] = {statusCode:1032 , id: -1};
                    return cb();
                }
                else if(options.configuration.importType === 'addUpdate'){
                    executeInsert(options,connection,[dataValue],function(err,results){
                        if(err){
                            logger.error('executeInsert', util.inspect(err, {depth: null}));
                            toReturn[index] = {statusCode:err.errno , id: -1};
                            return cb();
                        }
                        toReturn[index]=results[0];
                        return cb();
                    });
                }
            }
            else{
                toReturn[index]={statusCode: 200, id: options.preMapData[index][options.configuration.keyField]};
                cb();
            }
        });
    },function (){
        return callback(null,toReturn);
    });
}

/*--------------------------------------------------------------------------
** Function Name    : executeInsert
** Description      : Funtion to insert rows.
**
**------------------------------------------------------------------------*/
function executeInsert(options,connection,insertData,callback){
    var data = [];
    var toReturn = [];
    var query = ' insert into ?? ( ?? ) values ? ';
    var keys = Object.keys(options.postMapData[0]);

    _.forEach(insertData, function(dataValue){
        var temp=[];
        _.forEach(keys, function(colValue){
            temp.push(dataValue[colValue]);
        });
        data.push(temp);
    });

    async.eachOf(data,function(record, index, cb){
        var args = [];
        args.push(options.configuration.table);
        args.push(keys);
        args.push([record]);
        var tempQuery = connection.format(query,args);
        connection.query(tempQuery,function(err,results) {
            if(err){
                toReturn[index] = {statusCode:err.errno , id: -1};
                return cb();
            }
            else {
                toReturn[index]={statusCode: 200, id: results.insertId};
                return cb();
            }
        });
    }, function(){
        return callback(null,toReturn);
    });
}

/*--------------------------------------------------------------------------
** Function Name    : getMySQLConnectionHelper
** Description      : Helper function to craete the connection based on
**                    the configuration. Use the below sample to configure
**
**  unEncrypted:{
**      port: xxxx,
**      database: 'xxxxxxxxxx',
**      user: 'xxxxxxxxxx',
**      host: 'xxxxxxxxxx'
**  },
**   encrypted: {
**      password: 'xxxxxxxxxx'
**  }
**
**------------------------------------------------------------------------*/
function getMySQLConnectionHelper (options, callback) {
    if (!options.connection || !options.connection.unencrypted || !options.connection.encrypted) {
        return callback(new Error('!options.connection || !options.connection.unencrypted || !options.connection.encrypted'));
    }
    var dbconfig = {
        host : options.connection.unencrypted.host,
        user : options.connection.unencrypted.user,
        database : options.connection.unencrypted.database,
        port : options.connection.unencrypted.port,
        password : options.connection.encrypted.password
    }
    var connection = mysql.createConnection(dbconfig);
    connection.connect(function (err) {
        if (err) {
            logger.error('connection.connect', util.inspect(err, {depth: null}));
            return callback(err);
        }
        return callback(null, connection);
    });
}

/*--------------------------------------------------------------------------
** Function Name    : getPropertyField
** Description      : Funtion to find columns of table based on some property.
**
**------------------------------------------------------------------------*/
function getPropertyField(connection, table, property, callback){
    var query = 'select column_name from information_schema.columns where table_schema=database() and table_name=? and extra=?';
    var args=[];
    args.push(table);
    args.push(property);

    var query = connection.format(query,args);
    connection.query(query, function(err,rows){
        if(err){
            return callback(err);
        }
        else if(rows.length==1){
            return callback(null, rows[0]['column_name']);
        }
        else{
            return callback(new Error(rows.length > 1 ? 'Too many `'+property+'` fields in table' : 'Missing `'+property+'` field in table'));
        }
    });
}

exports.wrappers = wrappers
