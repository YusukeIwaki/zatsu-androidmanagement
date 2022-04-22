const { GoogleAuth } = require('google-auth-library')
const path = require('path')
const fs = require('fs')
const { updateKeyValue, useFileCache } = require('@zatsu/core')

/**
 * @typedef {{project_id: string, client_email: string, private_key: string}} KeyJsonPayload
 */

const credentialsCache = useFileCache('androidmanagement', 'credentials')
const accessTokenCache = useFileCache('androidmanagement', 'access_token')

/**
 *
 * @param {string} keyJsonFilename
 */
async function saveCredentials(keyJsonFilename) {
    const keyJson = await getJsonKeyFileContent(keyJsonFilename)

    if (!keyJson.project_id) {
        throw new Error('The given credentials must contain project_id')
    }

    // try to get access token before save.
    const accessToken = await fetchAccessToken(keyJson)

    if (!accessToken) {
        throw new Error('access token cannot be acquired. The given credentials may be wrong.')
    }

    await Promise.all([
        cacheCredentials(keyJson).then(() => { console.log(`credentials are stored in ${credentialsPath}`) }),
        cacheAccessToken(accessToken).then(() => { console.log(`access token is stored in ${accessTokenPath}`) }),
    ])
}

/**
 *
 * @param {string} keyJsonFilename
 * @returns {Promise<KeyJsonPayload>}
 */
async function getJsonKeyFileContent(keyJsonFilename) {
    return JSON.parse(await fs.promises.readFile(keyJsonFilename, { encoding: 'utf-8' }))
}

/**
 *
 * @param {KeyJsonPayload} keyJson
 */
async function cacheCredentials(keyJson) {
    await credentialsCache.put(JSON.stringify(keyJson))
}

/**
 *
 * @returns {Promise<KeyJsonPayload|undefined>}
 */
async function getCachedCredentials() {
    const credentialsContent = await credentialsCache.get()
    if (!credentialsContent) return

    try {
        return JSON.parse(credentialsContent.toString('utf8'))
    } catch (_) {
        return
    }
}

/**
 *
 * @param {KeyJsonPayload} keyJson
 * @returns {Promise<string | undefined>}
 */
async function fetchAccessToken(keyJson) {
    const auth = new GoogleAuth({
        credentials: {
            client_email: keyJson.client_email,
            private_key: keyJson.private_key,
        },
        scopes: [
            "https://www.googleapis.com/auth/androidmanagement"
        ]
    })
    const accessToken = await auth.getAccessToken()
    if (!accessToken) return
    return accessToken
}

/**
 *
 * @returns {Promise<string | undefined>}
 */
async function getCachedAccessToken() {
    const token = accessTokenCache.get()
    if (!token) return

    try {
        return token.toString('utf8')
    } catch (_) {
        return
    }
}

/**
 *
 * @param {string} accessToken
 */
async function cacheAccessToken(accessToken) {
    await accessTokenCache.put(accessToken)
}

/**
 *
 */
async function invalidateAccessToken() {
    await accessTokenCache.delete()
}

/**
 *
 * @returns {import('@zatsu/core').Interceptor}
 */
function createGoogleAuthInterceptor() {
    return async (performRequest, request) => {
        const keyJson = await getCachedCredentials()
        if (!keyJson) {
            throw new Error('configure is required')
        }
        let cachedAccessToken = await getCachedAccessToken()
        let accessToken = cachedAccessToken || await fetchAccessToken(keyJson)
        if (!accessToken) {
            throw new Error('access token cannot be acquired')
        }
        request.headers.push(['Authorization', `Bearer ${accessToken}`])
        const queryParameters = new URLSearchParams()
        for (const [name, value] of request.queryParameters) {
            const newValue = value.replace('{projectId}', keyJson.project_id)
            queryParameters.append(name, newValue)
        }
        request.queryParameters = queryParameters

        let response = await performRequest(request)

        if (response.status == 401) {
            await invalidateAccessToken()
            cachedAccessToken = undefined
            accessToken = await fetchAccessToken(keyJson)
            if (!accessToken) {
                throw new Error('access token cannot be acquired')
            }

            // Replace existing Authorization header.
            updateKeyValue(request.headers, 'Authorization', `Bearer ${accessToken}`)

            response = await performRequest(request)
        }

        if (response.status < 300) {
            if (!cachedAccessToken) {
                await cacheAccessToken(accessToken)
            }
        }

        return response
    }
}

module.exports = { saveCredentials, createGoogleAuthInterceptor }
