import axios from 'axios'

export default class API {

  // todo: refactore URL building
  constructor(url) {
    this.client = axios.create({
      baseURL: url
    })
  }

  parseCatResponse(data) {
    const struct = String( data ).split('\n').map(line => line.split(' ').filter(item => item !== '')).filter(row => row.length)
    if (struct) {
      return {
        columns: struct[0],
        data: struct.splice(1)
      }
    }

    return false;
  }

  async test() {
    try {
      const response = await this.client.get('/')
      if (response.data && response.data.tagline) 
        return {
          success: true, message: response.data.tagline
        }
      return {
        success: false, message: 'Something went wrong'
      }
    } catch (err) {
      return {
        success: false, message: err.message
      }
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
}

class ConnectionError extends Error {
  constructor(message) {
    super(message)
    this.type = 'ConnectionError'
    this.message = `Could not connect to the server: ${this.message}`
  }
}