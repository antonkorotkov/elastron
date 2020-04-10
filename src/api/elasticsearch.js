import axios from 'axios'

export default class API {

  constructor(url) {
    this.client = axios.create({
      baseURL: url
    })
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
}