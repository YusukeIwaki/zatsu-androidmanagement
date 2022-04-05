# @zatsu/androidmanagement

**DEPRECATED** The Dart version of AndroidManagement API v1 client is a good alternative to this app.
https://github.com/YusukeIwaki/rakuda-androidamanagement-api

---

## Install

```
npm install -g @zatsu/androidmanagement
```

or `npx @zatsu/androidmanagement` for instant usage

## Usage

### Configuration

```
$ androidmanagement configure ~/path/to/service_account_keyfile.json
```

### Execute GET request

```
$ androidmanagement GET /enterprises?project_id={projectId}

{
  "enterprises": [
    {
      "name": "enterprises/LC01??????c",
      "enterpriseDisplayName": "YusukeIwaki"
    },
    {
      "name": "enterprises/LC02??????9",
      "enterpriseDisplayName": "test_enterprise"
    }
  ]
}
```

### Execute POST request

```
$ echo "{ enterpriseDisplayName: 'YusukeIwaki' }" | androidmanagement POST /enterprises projectId={projectId} agreementAccepted=true

{
  "name": "enterprises/LC01??????c",
  "enterpriseDisplayName": "YusukeIwaki"
}
```
