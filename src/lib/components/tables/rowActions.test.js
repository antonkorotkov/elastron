import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Row actions are a cross-component convention: a cell renderer marks its
 * buttons `.cell-action`, and the styling that hides them until the row is
 * hovered lives once in global.css. It cannot live in a component, because a
 * cell only knows about its own cell, not the row around it — which is how the
 * first version ended up revealing actions on cell hover instead of row hover.
 *
 * These guard the rule rather than the rendering: jsdom does not evaluate
 * :hover, so a component test could not catch a regression here.
 */
const globalCss = readFileSync('static/global.css', 'utf8');

const walk = dir =>
	readdirSync(dir).flatMap(entry => {
		const path = join(dir, entry);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});

const svelteFiles = walk('src').filter(p => p.endsWith('.svelte'));

const cellRenderers = svelteFiles.filter(p => readFileSync(p, 'utf8').includes('class="cell-action"'));

describe('row action styling', () => {
	it('is defined once, in the global stylesheet', () => {
		expect(globalCss).toMatch(/^\.cell-action\s*\{/m);
	});

	it('reveals actions from anywhere on the row, not just the cell', () => {
		expect(globalCss).toMatch(/tr:hover\s+\.cell-action\s*\{/);
	});

	it('gives keyboard users the same affordance', () => {
		expect(globalCss).toMatch(/\.cell-action:focus-visible/);
	});

	it('brings a hovered action to full strength after the row rule, so it wins', () => {
		const rowRule = globalCss.search(/tr:hover\s+\.cell-action\s*\{/);
		const actionRule = globalCss.search(/tr\s+\.cell-action:hover/);

		expect(rowRule).toBeGreaterThan(-1);
		expect(actionRule).toBeGreaterThan(rowRule);
	});

	it('is used by more than one table, which is why it is shared', () => {
		expect(cellRenderers.length).toBeGreaterThan(1);
	});

	it.each(cellRenderers)('%s does not re-declare the shared treatment', file => {
		const source = readFileSync(file, 'utf8');
		const styles = source.slice(source.indexOf('<style>'));

		// A component re-declaring the base rule, or scoping the reveal to one
		// cell, is what this convention exists to prevent.
		expect(styles).not.toMatch(/^\s*\.cell-action\s*\{/m);
		expect(styles).not.toMatch(/\.[\w-]*cell:hover\s+\.cell-action/);
	});
});
