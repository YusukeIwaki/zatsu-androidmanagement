#!/usr/bin/env node

const { executeHTTPRequest } = require('@zatsu/core')
const { saveCredentials, createGoogleAuthInterceptor } = require('./auth')

if (process.argv[2] == 'configure') {
    const keyFilename = process.argv[3]
    if (!keyFilename) {
        throw new Error('configure path/to/service_account_key.json')
    }
    (async () => {
        await saveCredentials(keyFilename)
    })()
} else {
    (async () => {
        await executeHTTPRequest(process.argv.slice(2), {
            baseURL: 'https://androidmanagement.googleapis.com/v1',
            interceptors: [
                createGoogleAuthInterceptor()
            ],
        })
    })()
}
