const btoa = require('btoa')

const buildConnectionUrl = connection => {
  const { host, port } = connection
  return `${host.replace(/\/+$/, '')}${Number(port) > 0 ? `:${port}` : ''}`
}

class Options {
  defaults = {
    size: -1,
    limit: 100,
    offset: 0,
    debug: false,
    type: 'data',
    delete: false,
    maxSockets: null,
    input: null,
    'input-index': null,
    output: null,
    'output-index': null,
    noRefresh: false,
    inputTransport: null,
    outputTransport: null,
    searchBody: null,
    searchWithTemplate: false,
    filterSystemTemplates: true,
    templateRegex: '^(metrics|logs|.+_audit_log|.+-index-template|\\..+)$',
    headers: null,
    'input-headers': null,
    'output-headers': null,
    sourceOnly: false,
    jsonLines: false,
    format: '',
    'ignore-errors': false,
    'support-big-int': false,
    'big-int-fields': '',
    scrollId: null,
    scrollTime: '10m',
    scrollRetryDelay: 15000,
    'scroll-with-post': false,
    timeout: null,
    toLog: null,
    quiet: false,
    awsChain: false,
    awsAccessKeyId: null,
    awsSecretAccessKey: null,
    awsIniFileProfile: null,
    awsService: null,
    awsRegion: null,
    awsUrlRegex: null,
    s3AccessKeyId: null,
    s3SecretAccessKey: null,
    s3Region: null,
    s3Endpoint: null,
    s3SSLEnabled: true,
    s3ForcePathStyle: false,
    s3Compress: false,
    s3ServerSideEncryption: null,
    s3SSEKMSKeyId: null,
    s3ACL: null,
    fsCompress: false,
    awsIniFileName: null,
    sessionToken: null,
    transform: null,
    httpAuthFile: null,
    params: null,
    'input-params': null,
    'output-params': null,
    prefix: '',
    suffix: '',
    retryAttempts: 0,
    customBackoff: false,
    retryDelayBase: 0,
    retryDelay: 5000,
    parseExtraFields: '',
    fileSize: -1,
    maxRows: -1,
    cert: null,
    key: null,
    pass: null,
    ca: null,
    tlsAuth: false,
    'input-cert': null,
    'input-key': null,
    'input-pass': null,
    'input-ca': null,
    'output-cert': null,
    'output-key': null,
    'output-pass': null,
    'output-ca': null,
    inputSocksProxy: null,
    inputSocksPort: null,
    outputSocksProxy: null,
    outputSocksPort: null,
    concurrency: 1,
    throttleInterval: 1,
    carryoverConcurrencyCount: true,
    intervalCap: 5,
    concurrencyInterval: 5000,
    overwrite: false,
    handleVersion: false,
    versionType: null,

    // csv options
    csvDelimiter: ',',
    csvRowDelimiter: '\n',
    csvFirstRowAsHeaders: true,
    csvRenameHeaders: false,
    csvWriteHeaders: true,
    csvHandleNestedData: false,
    csvIdColumn: null,
    csvIndexColumn: null,
    csvTypeColumn: null,
    csvCustomHeaders: null,
    csvIgnoreEmpty: false,
    csvMaxRows: 0,
    csvSkipLines: 0,
    csvSkipRows: 0,
    csvTrim: false,
    csvRTrim: false,
    csvLTrim: false,
    csvDiscardUnmappedColumns: false,
    csvQuoteChar: '"',
    csvEscapeChar: '"',
  }

  constructor(rendererOptions) {
    this.rendererOptions = rendererOptions
  }

  /**
   * Get type of input
   * @returns string
   */
  getInputType() {
    const {
      importExport: {
        input: { type },
      },
    } = this.rendererOptions

    return type
  }

  /**
   * get type of output
   * @returns string
   */
  getOutputType() {
    const {
      importExport: {
        output: { type },
      },
    } = this.rendererOptions

    return type
  }

  /**
   * input getter
   */
  get input() {
    const {
      importExport: { input },
      connection,
      connections,
    } = this.rendererOptions

    switch (this.getInputType()) {
      case 'file':
        const { file } = input
        return file

      case 'manual':
        const { address } = input
        return address

      case 'index':
        return buildConnectionUrl(connection)

      case 'remote-index':
        const { connection: connectionIndex } = input
        return buildConnectionUrl(connections[connectionIndex])
    }

    return null
  }

  /**
   * output getter
   */
  get output() {
    const {
      importExport: { output },
      connection,
      connections,
    } = this.rendererOptions

    switch (this.getOutputType()) {
      case 'file':
        const { file } = output
        return `${file}/dump-${new Date()
          .toISOString()
          .replaceAll(' ', '-')
          .toLowerCase()}.json`

      case 'manual':
        const { address } = output
        return address

      case 'index':
        return buildConnectionUrl(connection)

      case 'remote-index':
        const { connection: connectionIndex } = output
        return buildConnectionUrl(connections[connectionIndex])
    }

    return null
  }

  /**
   * options getter
   */
  get options() {
    const {
      importExport: { options: incomingOptions, type, input, output },
    } = this.rendererOptions

    let _options = {
      ...this.defaults,
    }

    // extend options with incoming options
    for (let option of incomingOptions) {
      if (typeof _options[option.name] !== undefined) {
        // convert booleans to real booleans
        if (option.value === 'true') {
          _options[option.name] = true
          continue
        }

        if (option.value === 'false') {
          _options[option.name] = false
          continue
        }

        _options[option.name] = option.value
      }
    }

    // extend options with immutable options
    _options = {
      ..._options,
      input: this.input,
      output: this.output,
      type,
    }

    // determine input index
    if (
      this.getInputType() === 'index' ||
      this.getInputType() === 'remote-index'
    ) {
      const { index } = input
      _options['input-index'] = index
    }

    // determine output index
    if (
      this.getOutputType() === 'index' ||
      this.getOutputType() === 'remote-index'
    ) {
      const { index } = output
      _options['output-index'] = index
    }

    _options['input-headers'] = this.getHeaders(
      _options['input-headers'],
      'input'
    )
    _options['output-headers'] = this.getHeaders(
      _options['output-headers'],
      'output'
    )

    return _options
  }

  /**
   * Get auth header
   * @param {*} user
   * @param {*} password
   * @returns
   */
  getAuthHeader(user, password) {
    return {
      Authorization: `Basic ${btoa(`${user}:${password}`)}`,
    }
  }

  /**
   * Get headers
   * @param {*} current
   * @param {*} way
   * @returns
   */
  getHeaders(current, way) {
    try {
      const currentInputHeaders = JSON.parse(current)

      const types = {
        input: this.getInputType(),
        output: this.getOutputType(),
      }

      if (types[way] === 'index') {
        const { connection } = this.rendererOptions

        if (connection.useAuth) {
          const authHeaderObject = this.getAuthHeader(
            connection.user,
            connection.password
          )
          return {
            ...currentInputHeaders,
            ...authHeaderObject,
          }
        }

        return currentInputHeaders
      }

      if (types[way] === 'remote-index') {
        const {
          importExport: {
            [way]: { connection },
          },
          connections,
        } = this.rendererOptions

        const theConnection = connections[connection]

        if (theConnection.useAuth) {
          const authHeaderObject = this.getAuthHeader(
            theConnection.user,
            theConnection.password
          )
          return {
            ...currentInputHeaders,
            ...authHeaderObject,
          }
        }

        return currentInputHeaders
      }
    } catch (e) {
      throw new Error(`Could not parse ${way} headers. Please use valid JSON.`)
    }
  }
}

module.exports.Options = Options
