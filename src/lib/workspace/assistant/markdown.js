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
 *
 * Images are never rendered. The page would fetch an image URL as soon as
 * the reply appears, so a prompt injection hidden in cluster data could make
 * the model write cluster data into an image URL and leak it with no click.
 * With the image rule off, `![alt](url)` renders as an ordinary link, which
 * only opens if the user clicks it.
 */
const md = new MarkdownIt({ html: false, linkify: true, breaks: true }).disable('image')

const PURIFY_OPTIONS = { USE_PROFILES: { html: true }, FORBID_TAGS: ['img'], ADD_ATTR: ['target'] }

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
	return DOMPurify.sanitize(md.render(source), PURIFY_OPTIONS)
}
