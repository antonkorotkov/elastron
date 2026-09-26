import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Dark mode in this app is Semantic UI's `inverted` classes, and this build of
 * Semantic ships an incomplete set of them. The gaps below were all found by
 * text and controls being unreadable on the security screens. They cannot be
 * fixed inside a component, because the light rules carry !important, so they
 * live in global.css and are pinned here.
 *
 * jsdom does not load external stylesheets, so these check the rules and the
 * markup rather than computed colour.
 */
const globalCss = readFileSync('static/global.css', 'utf8');
const semantic = readFileSync('static/semantic.min.css', 'utf8');

const walk = dir =>
	readdirSync(dir).flatMap(entry => {
		const path = join(dir, entry);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});

const securityComponents = walk('src/lib/workspace/security').filter(p => p.endsWith('.svelte'));
const source = Object.fromEntries(securityComponents.map(p => [p, readFileSync(p, 'utf8')]));

describe('gaps this Semantic build leaves in dark mode', () => {
	it('defines .ui.grey.text, which Semantic does not', () => {
		expect(semantic.includes('.ui.grey.text{')).toBe(false);
		expect(globalCss).toMatch(/^\.ui\.grey\.text\s*\{/m);
		expect(globalCss).toMatch(/\.ui\.modal\.inverted \.ui\.grey\.text/);
	});

	it('gives the modal content and actions a text colour', () => {
		// Modal.svelte paints them dark but colours only the header and pre.
		expect(globalCss).toMatch(/\.ui\.modal\.inverted > \.content/);
		expect(globalCss).toMatch(/\.ui\.modal\.inverted > \.actions/);
	});

	it('colours a header nested inside an inverted segment', () => {
		// Semantic only handles a header that is a direct child.
		expect(semantic).toContain('.ui.inverted.segment>.ui.header');
		expect(globalCss).toMatch(/\.ui\.inverted\.segment \.ui\.header/);
	});

	it('colours checkbox labels outside a form', () => {
		expect(globalCss).toMatch(/\.ui\.inverted\.segment \.ui\.checkbox label/);
	});
});

describe('security markup uses the inverted classes Semantic actually ships', () => {
	it('puts inverted on a basic button group, not on its child buttons', () => {
		// `.ui.basic.buttons .button` is coloured near-black with !important, so
		// a child carrying `inverted` cannot win. The group has to carry it.
		expect(semantic).toContain('.ui.basic.inverted.buttons .button');

		const dialog = source['src/lib/workspace/security/roles/RoleDialog.svelte'];
		expect(dialog).toMatch(/class="ui tiny basic buttons mode-switch"\s+class:inverted/);
		expect(dialog).not.toMatch(/class="ui button"\s+class:inverted/);
	});

	it.each(
		Object.entries(source).flatMap(([file, text]) =>
			[...text.matchAll(/class="(ui [^"]*\bbutton\b[^"]*)"([^>]*)/g)]
				.map(m => [file.split('/').pop(), m[1], m[2]])
				// A coloured basic button keeps a readable colour of its own; a
				// button group is handled through the group.
				.filter(([, cls]) => !/\b(blue|green|red|black)\b/.test(cls) && !/\bbuttons\b/.test(cls))
		)
	)('%s: %s carries inverted', (_file, cls, rest) => {
		const insideGroup = cls.trim() === 'ui button';
		expect(insideGroup || /class:inverted/.test(rest) || /\binverted\b/.test(cls)).toBe(true);
	});
});
