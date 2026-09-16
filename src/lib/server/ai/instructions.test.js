import { describe, it, expect } from 'vitest'
import { buildInstructions } from './instructions'

describe('buildInstructions', () => {
	it('states the cluster version and flavor', () => {
		const text = buildInstructions({ version: '9.1.0', flavor: 'serverless' })
		expect(text).toContain('Elasticsearch 9.1.0')
		expect(text).toContain('serverless')
	})

	it('omits the flavor when the cluster does not report one', () => {
		const text = buildInstructions({ version: '8.12.0' })
		expect(text).toContain('Elasticsearch 8.12.0')
		expect(text).not.toContain('build flavor')
	})

	it('handles an unknown version', () => {
		expect(buildInstructions()).toContain('version is unknown')
	})

	it('guides the model to validate and hand off queries', () => {
		const text = buildInstructions({ version: '9.1.0' })
		expect(text).toContain('validate-query')
		expect(text).toContain('propose-query')
	})

	it('steers the model to answer with read tools and put parameters in querystring', () => {
		const text = buildInstructions({ version: '9.1.0' })
		expect(text).toContain('sort store.size:desc')
		expect(text).toContain('querystring')
	})

	it('explains that later index pages need approval', () => {
		expect(buildInstructions({ version: '9.1.0' })).toMatch(/list-indices returns one page of 50.*user approves each one/)
	})

	it('directs the model to make requested changes itself', () => {
		const text = buildInstructions({ version: '9.1.0' })
		expect(text).toContain('make the change yourself with the matching tool')
		expect(text).toContain("Don't reply with steps, curl commands, or requests for the user to run by hand")
	})

	it('treats the approval card as the confirmation', () => {
		expect(buildInstructions({ version: '9.1.0' })).toContain('That card is the confirmation, so call the tool directly')
	})

	it('routes uncovered operations and multi-index deletes to tools', () => {
		const text = buildInstructions({ version: '9.1.0' })
		expect(text).toMatch(/reindexing.*use run-es-request/)
		expect(text).toContain('call them once per index')
		expect(text).toContain('fix the input, and call the tool again')
	})

	it('answers short questions directly', () => {
		expect(buildInstructions({ version: '9.1.0' })).toContain('When a question has a short answer')
	})

	it('hands over a card after running a search the user wants to see', () => {
		const text = buildInstructions({ version: '9.1.0' })
		expect(text).toMatch(/asks to search for documents or to see results, run the search yourself/)
		expect(text).toContain('Then hand the same query over with propose-query')
		expect(text).toContain("Don't paste the hits as JSON")
	})

	it('keeps the handoff for queries the user wants to run themselves', () => {
		expect(buildInstructions({ version: '9.1.0' })).toContain('Also use propose-query when the user wants a query or request to open, run, or edit themselves')
	})

	it('never includes connection details even when they are passed in', () => {
		const text = buildInstructions({
			version: '9.1.0',
			flavor: 'default',
			host: 'es-prod.internal.example.com',
			port: '9243',
			user: 'elastic',
			password: 'super-secret',
			apiKey: 'sk-live-123',
		})
		for (const secret of ['es-prod.internal.example.com', '9243', 'elastic:', 'super-secret', 'sk-live-123']) {
			expect(text).not.toContain(secret)
		}
	})
})
