import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// A dropdown opening over a JSON editor was painted through by ace: the list
// defaults to z-index 2, while ace stacks its gutter at 4 and its scroller at
// 1000.
const dropdown = readFileSync('src/lib/components/inputs/AdvancedDropdown.svelte', 'utf8');
const ace = readFileSync('node_modules/jsoneditor/dist/jsoneditor.min.js', 'utf8');

// ace's own overlays sit far higher, but they are transient and never open
// while this list is, so only the layers it paints permanently matter.
const OVERLAYS = /autocomplete|ace_search|tooltip/;

const layers = () => {
	const found = new Map();
	const rule = /(\.ace_[\w-]+[^{}]{0,80})\{([^{}]{0,400}?)\}/g;
	let match;
	while ((match = rule.exec(ace)) !== null) {
		const z = /z-index:\s*(\d+)/.exec(match[2]);
		if (!z) continue;
		const selector = match[1].trim();
		if (OVERLAYS.test(selector)) continue;
		found.set(selector, Math.max(found.get(selector) ?? 0, Number(z[1])));
	}
	return found;
};

describe('a dropdown opening over a JSON editor', () => {
	const listZ = Number(/--list-z-index:\s*(\d+)/.exec(dropdown)?.[1]);

	it('sets a list z-index rather than taking the default of 2', () => {
		expect(listZ).toBeGreaterThan(2);
	});

	it('clears every layer ace paints permanently', () => {
		const found = layers();
		expect(found.size).toBeGreaterThan(3);

		const tooHigh = [...found].filter(([, z]) => z >= listZ);
		expect(tooHigh).toEqual([]);
	});
});
