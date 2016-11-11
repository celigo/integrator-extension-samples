# integrator-extension-samples
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

Integrator-extension-samples provides non-managed, pre-built integrations that can easilly be installed into any [integrator.io](http://www.celigo.com/ipaas-integration-platform/) account, and can be used as starter kits to help users jump start building their own custom DIY integrations. It includes all the components needed to integrate two or more applications, including connections, exports, imports, flows, data mappings, etc. You can modify it in any way you see fit for your own custom integration requirements.

_**Note**: In order to use these integrations, the user should know how to [create a data flow on integrator.io](http://support.celigo.com/hc/en-us/articles/216377808-Create-Data-Flows-in-Integrator-io) and the use of [integrator-extension](https://github.com/celigo/integrator-extension)._

Currenty we have below integrations available for user reference:

* [MySQL](##mysql)

## MySQL

The MySQL integration enables a user to import/export data between a mysql application and third party through  [integrator.io](http://www.celigo.com/ipaas-integration-platform/). The integration has two components.

#### Export
Other then the standard configuration options provided in the export UI, the user can also make use of configuration box to set/create the fields as per requirements. The existing integration has support for below options.

```json
{
  "table": "TABLE_NAME",
  "size": 2
}
```
* **_table_**: name of the SQL table from which data needs to be exported.
* **_size_**: the number of rows to be exported at a time.

#### Import
Along with the standard import options provided by [integrator.io](http://www.celigo.com/ipaas-integration-platform/), below options are availbe to user to set as per the requirements. The user can expand the functionality by creating new fields.
```json
{
  "importType": "add",
  "table": "TABLE_NAME",
  "ignoreExistingRecords": "false",
  "ignoreMissingRecords": "false",
  "existingRecCondition": {
    "condition": " COL_A = ? and COL_B = ? ",
    "colField": ["COL_C","COL_D"]
  }
}
```
* _**importType**_: supported operations are add/update/addUpdate
* _**table**_: Table name for importing data
* _**ignoreExistingRecords**_: (for ADD) when set to false will try to insert the rows without checking the existing records.
* _**ignoreMissingRecords**_: (for UPDATE) when set to false will not throw any error when the record to be updated is missing.
* _**existingRecCondition**_: A mysql where condition to check if the record already exists. It should be configured for all kind of operations except that of pure INSERT i.e. importType is "ADD" and ignoreExistingRecords is "true".
* _**condition**_: It is used for checking existing records and updating records. The condition needs to be written in MySql syntax where COL_A, COL_B represent table columns of import table.
* _**colField**_: COL_C, COL_D are the table columns against which COL_A, COL_B needs to be checked.

_**Note**: Make sure that for all the operations of type ADD, UPDATE and ADDUPDATE, the EXTERNAL_ID of source table is mapped to the auto_increment key field of destination table._

---
## Contact
_If you need the sample integrations or any assistance please drop a mail to celigo-labs@celigo.com_
