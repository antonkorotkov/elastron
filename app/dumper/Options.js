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

  get input() {
    const {
      importExport: { input },
    } = this.rendererOptions

    const { type, file, index, connection, address } = input

    switch (type) {
      case 'manual':
        return address
    }
  }

  get output() {
    const {
      importExport: { output },
    } = this.rendererOptions

    const { type, file, index, connection, address } = output

    switch (type) {
      case 'manual':
        return address
    }
  }

  get options() {
    const {
      importExport: { options: incomingOptions, type },
    } = this.rendererOptions
    const _options = { ...this.defaults }

    _options.input = this.input
    _options.output = this.output

    for (let option of incomingOptions) {
      if (typeof _options[option.name] !== undefined) {
        _options[option.name] = option.value
      }
    }

    _options.type = type

    return _options
  }
}

module.exports.Options = Options
