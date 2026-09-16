import { describe, it, expect } from 'vitest'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { asSchema } from '@ai-sdk/provider-utils'
import { z } from 'zod'
import { toolDefinitions } from './index.js'

// Each provider converts tool schemas its own way and reports anything it had
// to change as a warning at the start of the stream. This runs the real
// providers on the real tool schemas, stopping at the first stream part.
const emptyStream = async () =>
	new Response('data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })

const providers = {
	'openai (responses)': () => createOpenAI({ apiKey: 'test', fetch: emptyStream })('gpt-5.1'),
	'openai (chat)': () => createOpenAI({ apiKey: 'test', fetch: emptyStream }).chat('gpt-5.1'),
	anthropic: () => createAnthropic({ apiKey: 'test', fetch: emptyStream })('claude-opus-5'),
	google: () => createGoogleGenerativeAI({ apiKey: 'test', fetch: emptyStream })('gemini-3-pro'),
	custom: () => createOpenAICompatible({ name: 'custom', apiKey: 'test', baseURL: 'http://localhost/v1', fetch: emptyStream })('llama3.1'),
}

const asTools = definitions =>
	Object.entries(definitions).map(([name, definition]) => ({
		type: 'function',
		name,
		description: definition.description,
		inputSchema: asSchema(definition.inputSchema).jsonSchema,
	}))

const warningsFor = async (model, tools) => {
	const { stream } = await model.doStream({
		prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
		tools,
	})
	const reader = stream.getReader()
	const { value } = await reader.read()
	await reader.cancel().catch(() => {})
	return value?.type === 'stream-start' ? value.warnings : []
}

describe('tool schemas across providers', () => {
	it('catches the propertyNames warning a record schema would cause', async () => {
		const tools = asTools({ probe: { description: 'probe', inputSchema: z.object({ q: z.record(z.string(), z.string()) }) } })
		const warnings = await warningsFor(providers['openai (responses)'](), tools)
		expect(warnings.map(w => w.feature)).toContain('JSON Schema propertyNames')
	})

	it('emits no propertyNames anywhere in the tool schemas', () => {
		expect(JSON.stringify(asTools(toolDefinitions))).not.toContain('propertyNames')
	})

	it.each(Object.keys(providers))('%s accepts every tool schema without warnings', async name => {
		expect(await warningsFor(providers[name](), asTools(toolDefinitions))).toEqual([])
	})
})
