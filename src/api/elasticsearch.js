import axios from 'axios'
import get from 'lodash/get'

export default class API {
  /**
   *
   * @param {*} connection
   */
  constructor(connection) {
    this.client = axios.create({
      baseURL: this.buildConnectionUrl(connection),
      headers: this.buildConnectionHeaders(connection),
    })
  }

  /**
   *
   * @param {*} connection
   */
  buildConnectionHeaders(connection) {
    const { useAuth, user, password } = connection
    if (useAuth) {
      return {
        Authorization: `Basic ${btoa(`${user}:${password}`)}`,
      }
    }
  }

  /**
   *
   * @param {*} connection
   */
  buildConnectionUrl(connection) {
    const { host, port } = connection
    return `${host.replace(/\/+$/, '')}${Number(port) > 0 ? `:${port}` : ''}`
  }

  /**
   *
   * @param {*} data
   */
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

  /**
   *
   */
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

  /**
   *
   */
  async getIndices() {
    try {
      const response = await this.client.get('/_cat/indices?v')
      return this.parseCatResponse(response.data)
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   */
  async getAllocation() {
    try {
      const response = await this.client.get('/_cat/allocation?v')
      return this.parseCatResponse(response.data)
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   */
  async getShards() {
    try {
      const response = await this.client.get('/_cat/shards?v')
      return this.parseCatResponse(response.data)
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   * @param {*} params
   */
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

  /**
   *
   * @param {*} params
   */
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

  /**
   *
   * @param {*} index
   * @param {*} type
   * @param {*} id
   * @param {*} params
   */
  async deleteDocument(index, type, id, params = {}) {
    const response = await this.client.delete(`${index}/${type}/${id}`, {
      params,
    })
    return response.data
  }

  /**
   *
   * @param {*} index
   */
  async getIndex(index) {
    try {
      const response = await this.client.get(`/${index}`)
      return response.data
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   * @param {*} index
   */
  async deleteIndex(index) {
    try {
      const response = await this.client.delete(`/${index}`)
      return response.data
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   * @param {*} index
   */
  async closeIndex(index) {
    try {
      const response = await this.client.post(`/${index}/_close`)
      return response.data
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   * @param {*} index
   */
  async openIndex(index) {
    try {
      const response = await this.client.post(`/${index}/_open`)
      return response.data
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   * @param {*} index
   */
  async createIndex(index) {
    try {
      const response = await this.client.put(`/${index}`)
      return response.data
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   * @param {*} existingIndex
   * @param {*} newIndex
   */
  async cloneIndex(existingIndex, newIndex) {
    try {
      const response = await this.client.post(
        `/${existingIndex}/_clone/${newIndex}`
      )
      return response.data
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   * @param {*} index
   */
  async freezeIndex(index) {
    try {
      const response = await this.client.post(`/${index}/_freeze`)
      return response.data
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   * @param {*} index
   */
  async unfreezeIndex(index) {
    try {
      const response = await this.client.post(`/${index}/_unfreeze`)
      return response.data
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   * @param {*} index
   */
  async wipeIndex(index) {
    try {
      const response = await this.client.post(
        `/${index}/_delete_by_query?conflicts=proceed`,
        {
          query: {
            match_all: {},
          },
        }
      )
      return response.data
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   * @param {*} index
   * @param {*} mapping
   */
  async updateIndexMapping(index, mapping) {
    try {
      const types = Object.getOwnPropertyNames(mapping)
      if (types.length === 1 && types[0] === 'properties') {
        const response = await this.client.put(`/${index}/_mapping`, mapping)
        return response.data
      } else {
        const responses = []

        for (var i in mapping) {
          const response = await this.client.post(
            `/${index}/_mapping/${i}`,
            mapping[i]
          )
          responses.push(response.data)
        }

        return responses
      }
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   * @param {*} index
   * @param {*} settings
   */
  async updateIndexSettings(index, settings) {
    try {
      const response = await this.client.put(`/${index}/_settings`, settings)
      return response.data
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   * @param {*} index
   */
  async deleteIndexAlias(index, alias) {
    try {
      const response = await this.client.delete(`/${index}/_alias/${alias}`)
      return response.data
    } catch (err) {
      throw new ConnectionError(err)
    }
  }

  /**
   *
   */
  async createIndexAlias(index, alias, data) {
    try {
      const response = await this.client.post(`/${index}/_alias/${alias}`, data)
      return response.data
    } catch (err) {
      throw new ConnectionError(err)
    }
  }
}

class ConnectionError extends Error {
  constructor(error) {
    const message = get(
      error,
      'response.data.error.root_cause[0].reason',
      get(error, 'response.data.error.reason', error.message)
    )
    super(message)
    this.type = 'ConnectionError'
    this.message = message
  }
}
