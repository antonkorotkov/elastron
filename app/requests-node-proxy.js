const { default: axios } = require("axios")
const { Agent } = require("https")

/**
 *
 * @param {*} connection
 */
const buildConnectionHeaders = connection => {
  const { useAuth, user, password, addHeaders, headers } = connection

  let headersObject = {}

  if (useAuth) {
    headersObject.Authorization = `Basic ${btoa(`${user}:${password}`)}`
  }

  if (addHeaders && headers.length) {
    for (const header of headers) {
      headersObject[header.name] = header.value
    }
  }

  return headersObject
}

/**
 *
 * @param {*} connection
 */
const buildConnectionUrl = connection => {
  const { host, port } = connection
  return `${host.replace(/\/+$/, '')}${Number(port) > 0 ? `:${port}` : ''}`
}

const init = messaging => {
  let client;

  messaging.respond('elastic-request-client-init', (__, connection) => {
    client = axios.create({
      baseURL: buildConnectionUrl(connection),
      headers: buildConnectionHeaders(connection),
      httpsAgent: new Agent({
        rejectUnauthorized: false
      })
    })
  });

  messaging.respond('elastic-request', (__, method, ...args) => {
    return client[method](...args).then(({ data }) => ({ data }));
  })
}

module.exports = { init }