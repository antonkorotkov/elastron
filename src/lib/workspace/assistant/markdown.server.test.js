import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './markdown.js'

// Under plain Node there is no DOM for DOMPurify, as in server rendering.
describe('renderMarkdown without a DOM', () => {
	it('falls back to escaped plain text', () => {
		expect(renderMarkdown('**hi** <img src=x onerror=alert(1)>')).toBe(
			'<p>**hi** &lt;img src=x onerror=alert(1)&gt;</p>'
		)
	})
})
