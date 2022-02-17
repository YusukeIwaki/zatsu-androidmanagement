const { GoogleAuth } = require('google-auth-library')
const path = require('path')
const fs = require('fs')

/**
 * @typedef {{project_id: string, client_email: string, private_key: string}} KeyJsonPayload
 */

const cacheDir = path.join(
    process.env[process.platform == "win32" ? "USERPROFILE" : "HOME"],
    '.androidmanagement',
)
const credentialsPath = path.join(cacheDir, 'credentials')
const accessTokenPath = path.join(cacheDir, 'access_token')

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
    await fs.promises.mkdir(cacheDir, { recursive: true })
    await fs.promises.writeFile(credentialsPath, JSON.stringify(keyJson))
}

/**
 *
 * @returns {Promise<KeyJsonPayload|undefined>}
 */
async function getCachedCredentials() {
    try {
        const credentialsContent = (await fs.promises.readFile(credentialsPath)).toString('utf8')
        return JSON.parse(credentialsContent)
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
    try {
        return (await fs.promises.readFile(accessTokenPath)).toString('utf8')
    } catch (_) {
        return
    }
}

/**
 *
 * @param {string} accessToken
 */
async function cacheAccessToken(accessToken) {
    await fs.promises.mkdir(cacheDir, { recursive: true })
    await fs.promises.writeFile(accessTokenPath, accessToken)
}

/**
 *
 */
async function invalidateAccessToken() {
    await fs.promises.unlink(accessTokenPath)
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
            for (let index = 0; index < request.headers.length; index++) {
                if (request.headers[index][0] == 'Authorization') {
                    request.headers.splice(index, 1, ['Authorization', `Bearer ${accessToken}`])
                    break
                }
            }

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
