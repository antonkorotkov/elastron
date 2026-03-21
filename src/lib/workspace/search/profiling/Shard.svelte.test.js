// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Shard from './Shard.svelte';

describe('Profiling Shard', () => {
	it('renders shard id', () => {
		const shard = { id: '[xyz][0]', searches: [], aggregations: [] };
		render(Shard, { shard });
		expect(screen.getByText('[xyz][0]')).toBeTruthy();
	});
});
