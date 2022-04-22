#!/usr/bin/env node

const { buildRequestFromArgs, executeRequest, injectHeadersForJsonRequest, printResponseBody } = require('@zatsu/core')
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
        const request = await buildRequestFromArgs(process.argv.slice(2))
        const response = await executeRequest(request, {
            baseURL: 'https://androidmanagement.googleapis.com/v1',
            interceptors: [
                injectHeadersForJsonRequest,
                createGoogleAuthInterceptor()
            ],
        })
        if (!!response.body) {
            printResponseBody(response.body)
        }
    })()
}
