// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderMarkdown } from './markdown.js'

const dom = markdown => {
	const container = document.createElement('div')
	container.innerHTML = renderMarkdown(markdown)
	return container
}

describe('renderMarkdown in the renderer', () => {
	it('formats headings, emphasis, lists, and inline code', () => {
		const html = dom('## Largest indices\n**logs** is biggest, see `_cat/indices`.\n\n- logs\n- products\n\n1. first\n2. second')
		expect(html.querySelector('h2').textContent).toBe('Largest indices')
		expect(html.querySelector('strong').textContent).toBe('logs')
		expect(html.querySelector('p code').textContent).toBe('_cat/indices')
		expect([...html.querySelectorAll('ul li')].map(li => li.textContent)).toEqual(['logs', 'products'])
		expect(html.querySelectorAll('ol li')).toHaveLength(2)
	})

	it('formats fenced code and tables', () => {
		const html = dom('```json\n{ "query": { "match_all": {} } }\n```\n\n| index | docs |\n|---|---|\n| logs | 6 |')
		expect(html.querySelector('pre code').textContent).toContain('"match_all"')
		expect([...html.querySelectorAll('td')].map(td => td.textContent)).toEqual(['logs', '6'])
	})

	it('keeps single line breaks', () => {
		expect(dom('one\ntwo').querySelector('br')).toBeTruthy()
	})

	it('never renders raw HTML from a reply', () => {
		const html = dom('<img src=x onerror="window.pwned=1"><script>window.pwned=1</script><b>bold?</b>')
		expect(html.querySelector('img, script, b')).toBeNull()
		expect(html.textContent).toContain('<img src=x onerror="window.pwned=1">')
		expect(window.pwned).toBeUndefined()
	})

	it('refuses script, file, and data links', () => {
		const html = dom('[a](javascript:alert(1)) [b](file:///etc/passwd) [c](data:text/html,<b>x</b>) [d](vbscript:msgbox)')
		expect(html.querySelector('a')).toBeNull()
	})

	it('opens web links outside the app', () => {
		const link = dom('See [the docs](https://www.elastic.co/docs) or https://example.com').querySelector('a')
		expect(link.getAttribute('href')).toBe('https://www.elastic.co/docs')
		expect(link.getAttribute('target')).toBe('_blank')
		expect(link.getAttribute('rel')).toBe('noopener noreferrer')
		expect(dom('https://example.com').querySelector('a').getAttribute('href')).toBe('https://example.com')
	})

	it('handles empty and partial replies while streaming', () => {
		expect(renderMarkdown('')).toBe('')
		expect(dom('**bol').textContent.trim()).toBe('**bol')
		expect(dom('```js\nconst a').querySelector('pre code').textContent).toContain('const a')
	})
})
