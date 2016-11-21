# integrator-extension-samples
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

Integrator-extension-samples provides non-managed, pre-built integrations that can easily be installed into any [integrator.io](http://www.celigo.com/ipaas-integration-platform/) account, and can be used as starter kits to help users jump start building their own custom DIY integrations. It includes all the components needed to integrate two or more applications, including connections, exports, imports, flows, data mappings, etc. You can modify it in any way you see fit for your own custom integration requirements.

_**Note**: In order to use these integrations, the user should know how to [create a data flow on integrator.io](http://support.celigo.com/hc/en-us/articles/216377808-Create-Data-Flows-in-Integrator-io) and the use of [integrator-extension](https://github.com/celigo/integrator-extension)._

Currently we have below integrations available for user reference:

* [MySQL](#mysql)
* [Netsuite](#netsuite)
* [Salesforce](#salesforce)

## MySQL

The MySQL integration enables a user to import/export data between a MySQL application and third party through  [integrator.io](http://www.celigo.com/ipaas-integration-platform/). The integration has two components.

#### Export
Other then the standard configuration options provided in the export UI, the user can also make use of configuration box to set/create the fields as per requirements. The existing integration has support for below options.

```sh
{
  "table": "TABLE_NAME",
  "size": 2
}
```
* **_table_**: Name of the SQL table from which data needs to be exported.
* **_size_**: Number of rows to be exported at a time.

#### Import
Along with the standard import options provided by [integrator.io](http://www.celigo.com/ipaas-integration-platform/), below options are available to the user to set as per the requirements. The user can expand the functionality by creating new fields.
```sh
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
* _**importType**_: Supported operations are add/update/addUpdate.
* _**table**_: Table name for importing data.
* _**ignoreExistingRecords**_: (For ADD) When set to false will try to insert the rows without checking the existing records.
* _**ignoreMissingRecords**_: (For UPDATE) When set to false will not throw any error when the record to be updated is missing.
* _**existingRecCondition**_: A MySQL where condition to check if the record already exists. It should be configured for all kind of operations except that of pure INSERT i.e. importType is "ADD" and ignoreExistingRecords is "true".
* _**condition**_: It is used for checking existing records and updating records. The condition needs to be written in MySQL syntax where COL_A, COL_B represent table columns of import table.
* _**colField**_: COL_C, COL_D are the table columns against which COL_A, COL_B needs to be checked.

_**Note**: Make sure that for all the operations of type ADD, UPDATE and ADDUPDATE, the EXTERNAL_ID of source table is mapped to the auto_increment key field of destination table._

## Netsuite

Netsuite integration enables a user to import/export the attachments along with the record. This is done using the hooks functionality provided by [integrator.io](http://www.celigo.com/ipaas-integration-platform/) and netsuite nlapi's.

#### Export

In order to export attachment along with the record, a blob key needs to be generated for the attachment. This key is then sent along with the record. A sample blob key generation request looks like below.

```sh
{
  "url" : "https://api.integrator.io/v1/connections/" + _connectionId + "/export",
  "method" : "POST",
  "headers" : {
    "content-Type" : "application/json"
  },
  "auth" : {
    "bearer" : bearerToken
  },
  "json" : {
    "export" : {
      "type" : "blob",
      "netsuite" : {
        "internalId" : internalId
      }
    }
  }
}
```
* **__connectionId_**: netsuite connectionId used for the export.
* **_bearerToken_**: one time token provided in the hook options.
* **_internalId_**: attachment internalId in netsuite.

Upon successful completion the response should contain blob key and other netsuite data.

```sh
{
  "blobKey" : "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "netsuite" : {...}
}
```
The blob key received in the response could then be used to import the file on other systems.

#### Import

In order to import the attachment on netsuite the record should contain the blob key for the attachment. Below is the sample request to import the data.

```sh
{
  "url" : "https://api.integrator.io/v1/connections/" + _connectionId + "/import",
  "method" : "POST",
  "headers" : {
    "content-Type" : "application/json"
  },
  "auth" : {
    "bearer" : bearerToken
  },
  "json" : {
    "import" : {
      "blobKey" : blobKey,
      "netsuite" : {
        "operation" : operation,
        "file" : {
          "name" : fileName,
          "fileType" : "_PLAINTEXT",
          "folder" : folderInternalId,
          "internalId" : fileInternalId
        }
      }
    },
    "data" : {}
  }
}
```
* **__connectionId_**: netsuite connectionId used for the import.
* **_bearerToken_**: one time token provided in the hook options.
* **_operation_**: add,update or addupdate. "addupdate" is just a convenience based on whether internalId is present.
* **_name_**: file name, including extension name(usually .pdf).
* **_fileType_**: all NS file types from wsdl, optional, recommended to unset when "name" includes extension name.
* **_folder_**: internalId for the folder.
* **_internalId_**: internalId for the file, should not be used with operation "add", required with "update", optional with "addupdate".

Upon successful import on netsuite the response should be in below format

```sh
{
  "netsuite" : {
    "isSuccess" : true,
    "id" : attachmentInternalId
  }
}
```

## Salesforce

Salesforce integration enables user to export/import record along with the attachment.

#### Export

In order to export attachment along with the record, a blob key needs to be generated for the attachment. This key is then sent along with the record. A sample blob key generation request looks like below.

```sh
{
  "url" : "https://api.integrator.io/v1/connections/" + _connectionId + "/export",
  "method" : "POST",
  "headers" : {
    "content-Type" : "application/json"
  },
  "auth" : {
    "bearer" : bearerToken
  },
  "json" : {
    "export" : {
      "type" : "blob",
      "salesforce" : {
        "sObjectType" : "Attachment",
        "id" : attachmentId
      }
    }
  }
}

```
* **__connectionId_**: salesforce connectionId used for the export.
* **_bearerToken_**: one time token provided in the hook options.
* **id**: attachment id in salesforce.

Upon successful completion the response should contain blob key and other salesforce data.

```sh
{
  "blobKey" : "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "salesforce" : {...}
}
```
The blob key received in the response could then be used to import the file on other systems.

#### Import

In order to import the attachment on salesforce the record should contain the blob key for the attachment. Below is the sample request to import the data.

```sh
{
  "url" : "https://api.integrator.io/v1/connections/" + _connectionId + "/import",
  "method" : "POST",
  "headers" : {
    "content-Type" : "application/json"
  },
  "auth" : {
    "bearer" : bearerToken
  },
  "json" : {
    "import" : {
      "blobKey" : blobKey,
      "salesforce" : {
        "operation" : operation,
        "sObjectType" : "attachment",
        "attachment" : {
          "id" : salesforceId,
          "name" : name,
          "parentId" : parentId,
          "contentType" : "application/pdf",
          "isprivate" : true,
          "description" : description
        }
      }
    },
    "data" : {}
  }
}
```
* **__connectionId_**: salesforce connectionId used for the import.
* **_bearerToken_**: one time token provided in the hook options.
* **_operation_**: insert, update.
* **_id_**: salesforce id of file. Required only for update.
* **_name_**: file name, including extension name(usually .pdf). Required only for insert.
* **_parentId_**: salesforce id of the parent record. Required only for insert.
* **_contentType_**: MIME types, optional.
* **_isprivate_**: boolean value, optional.
* **_description_**: optional description.

Upon successful import on salesforce the response should be in below format

```sh
{
  "salesforce" : {
    "success" : true,
    "id" : attachmentId
  }
}
```

## Contact
_If you need the sample integrations or any assistance please drop a mail to celigo-labs@celigo.com._
