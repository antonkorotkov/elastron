import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A dialog taller than the window has to stay usable. The page dimmer centres
 * the modal with flexbox and cannot scroll, so an oversized modal has its top
 * and bottom cut off with no way to reach them.
 *
 * The fix deliberately does not touch how the dimmer aligns its child: that is
 * what centres every modal in the app, and the dimmer is `flex-direction:
 * column`, so its axes are swapped and easy to get backwards. Instead the modal
 * is capped at the viewport and made a column, so its content scrolls and there
 * is never any overflow to strand.
 *
 * jsdom does no layout and loads no external CSS, so this checks the rules.
 */
// Comments mention the properties these tests look for, so they are stripped.
const globalCss = readFileSync('static/global.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const semantic = readFileSync('static/semantic.min.css', 'utf8');

const walk = dir =>
	readdirSync(dir).flatMap(entry => {
		const path = join(dir, entry);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});

const dialogs = [...walk('src/lib/components/modal'), ...walk('src/lib/workspace/security')]
	.filter(p => p.endsWith('.svelte'))
	.map(p => [p, readFileSync(p, 'utf8')])
	.filter(([, src]) => src.includes('class="ui header"') && src.includes('actions'));

const ruleFor = selector =>
	globalCss.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*\\}`))?.[0] ?? '';

describe('a modal taller than the viewport', () => {
	it('is capped so it never exceeds the window', () => {
		expect(ruleFor('.ui.page.modals.dimmer > .ui.modal')).toMatch(/max-height:\s*calc\(100vh/);
	});

	it('becomes a column so its content can take the remaining space', () => {
		const rule = ruleFor('.ui.page.modals.dimmer > .ui.modal');
		expect(rule).toMatch(/display:\s*flex/);
		expect(rule).toMatch(/flex-direction:\s*column/);
	});

	it('scrolls the content, keeping the header and actions in place', () => {
		expect(ruleFor('.ui.page.modals.dimmer > .ui.modal > .content')).toMatch(/overflow-y:\s*auto/);
		expect(ruleFor('.ui.page.modals.dimmer > .ui.modal > .content')).toMatch(/min-height:\s*0/);
		expect(globalCss).toMatch(/\.ui\.page\.modals\.dimmer > \.ui\.modal > \.actions/);
	});

	it('leaves the dimmer alignment entirely to Semantic', () => {
		// The dimmer is flex-direction: column, so align-items is the horizontal
		// axis and justify-content the vertical one. Changing either moves or
		// strands every modal in the app; capping the modal avoids the question.
		expect(semantic).toContain('flex-direction:column');
		expect(ruleFor('.ui.page.modals.dimmer')).toBe('');
	});
});

describe('a dropdown inside a scrolling dialog', () => {
	it.each(
		dialogs.filter(([, src]) => src.includes('AdvancedDropdown')).map(([path]) => path)
	)('%s positions its list so the scrolling content cannot clip it', path => {
		const src = readFileSync(path, 'utf8');
		const dropdowns = (src.match(/<AdvancedDropdown/g) || []).length;
		const fixed = (src.match(/strategy: 'fixed'/g) || []).length;

		expect(dropdowns).toBeGreaterThan(0);
		expect(fixed).toBe(dropdowns);
	});
});
