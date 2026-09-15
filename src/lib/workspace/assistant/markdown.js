import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

/**
 * Renders the assistant's replies as Markdown.
 *
 * Replies are untrusted model output, and this renderer can reach stored
 * credentials through IPC, so raw HTML is never rendered: markdown-it runs
 * with `html: false`, which escapes it and refuses javascript:, vbscript:,
 * file:, and data: links, and DOMPurify sanitizes the result as a second
 * layer.
 */
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

// Links open outside the app: main.js hands new-window requests for http(s)
// URLs to the system browser.
const renderLinkOpen =
	md.renderer.rules.link_open ??
	((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
	tokens[idx].attrSet('target', '_blank')
	tokens[idx].attrSet('rel', 'noopener noreferrer')
	return renderLinkOpen(tokens, idx, options, env, self)
}

/**
 * Markdown to sanitized HTML. Where DOMPurify can't run (server rendering,
 * which never shows a conversation), it returns the text escaped instead.
 */
export const renderMarkdown = text => {
	const source = String(text ?? '')
	if (!DOMPurify.isSupported) return `<p>${md.utils.escapeHtml(source)}</p>`
	return DOMPurify.sanitize(md.render(source), { ADD_ATTR: ['target'] })
}
