import axios from 'axios'

export default class API {
  // todo: refactore URL building
  constructor(connection) {
    this.client = axios.create({
      baseURL: this.buildConnectionUrl(connection),
      headers: this.buildConnectionHeaders(connection),
    })
  }

  buildConnectionHeaders(connection) {
    const { useAuth, user, password } = connection
    if (useAuth) {
      return {
        Authorization: `Basic ${btoa(`${user}:${password}`)}`,
      }
    }
  }

  buildConnectionUrl(connection) {
    const { host, port } = connection
    return `${host.replace(/\/+$/, '')}${Number(port) > 0 ? `:${port}` : ''}`
  }

  parseCatResponse(data) {
    const struct = String(data)
      .split('\n')
      .map(line => line.split(' ').filter(item => item !== ''))
      .filter(row => row.length)
    if (struct) {
      return {
        columns: struct[0],
        data: struct.splice(1),
      }
    }

    return false
  }

  async test() {
    try {
      const response = await this.client.get('/', {
        timeout: 3000,
      })
      if (response.data && response.data.tagline)
        return {
          success: true,
          message: response.data.tagline,
        }
      return {
        success: false,
        message: 'Something went wrong',
      }
    } catch (err) {
      return {
        success: false,
        message: err.message,
      }
    }
  }

  async getIndices() {
    try {
      const response = await this.client.get('/_cat/indices?v')
      return this.parseCatResponse(response.data)
    } catch (err) {
      throw new ConnectionError(err.message)
    }
  }

  async getAllocation() {
    try {
      const response = await this.client.get('/_cat/allocation?v')
      return this.parseCatResponse(response.data)
    } catch (err) {
      throw new ConnectionError(err.message)
    }
  }

  async getShards() {
    try {
      const response = await this.client.get('/_cat/shards?v')
      return this.parseCatResponse(response.data)
    } catch (err) {
      throw new ConnectionError(err.message)
    }
  }

  async uriSearch(params) {
    const { index, type, query, size, from, sort, _source } = params
    const response = await this.client.get(
      `${index ? `/${index}` : ''}${type ? `/${type}` : ''}/_search`,
      {
        params: {
          q: query,
          size,
          from,
          sort,
          _source,
        },
      }
    )
    return response.data
  }

  async bodySearch(params) {
    const { index, type, query } = params
    const response = await this.client.post(
      `${index ? `/${index}` : ''}${type ? `/${type}` : ''}/_search`,
      {
        ...query,
      }
    )
    return response.data
  }
}

class ConnectionError extends Error {
  constructor(message) {
    super(message)
    this.type = 'ConnectionError'
    this.message = `Could not connect to the server: ${this.message}`
  }
}
