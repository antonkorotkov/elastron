/**
 * Returns a function that removes the API key from text, so an error message
 * that echoes the key (some providers do) can be shown or logged safely.
 */
export const createRedactor = apiKey => {
	const secret = typeof apiKey === 'string' ? apiKey.trim() : ''
	return text => {
		const value = String(text ?? '')
		return secret.length >= 4 ? value.split(secret).join('[redacted]') : value
	}
}

const STATUS_HINTS = {
	401: 'The provider rejected the API key.',
	403: 'The API key is not allowed to use this model.',
	404: 'The provider did not recognize the model. Check the model name in Settings.',
	429: 'The provider is rate limiting requests or the account is out of credit.',
}

/** A readable message for a provider or streaming failure. */
export const describeProviderError = error => {
	const status = error?.statusCode
	const detail = error?.message || String(error ?? 'Unknown error')
	const hint = STATUS_HINTS[status]
	return hint ? `${hint} (${status}: ${detail})` : detail
}
