// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ColorPicker from './ColorPicker.svelte';
import { CONNECTION_COLORS } from '../../utils/helpers';

/**
 * The component owns `value` through $bindable, so tests read the committed
 * color back off the hidden native input, which always mirrors it.
 */
const currentValue = container =>
	container.querySelector('input[type="color"]').value;

const hexField = container => container.querySelector('.hex-input');

describe('ColorPicker', () => {
	it('renders a swatch per preset, plus None and custom', () => {
		const { container } = render(ColorPicker, { value: '' });
		expect(container.querySelectorAll('.swatch')).toHaveLength(
			CONNECTION_COLORS.length + 2
		);
	});

	it('marks None as selected when there is no color', () => {
		const { container } = render(ColorPicker, { value: '' });
		expect(container.querySelector('.swatch.none').classList).toContain(
			'selected'
		);
	});

	it('marks the matching preset as selected', () => {
		const { container } = render(ColorPicker, { value: '#21ba45' });
		const selected = container.querySelector('.swatch.selected');
		expect(selected.getAttribute('aria-label')).toBe('#21ba45');
	});

	it('treats a color outside the presets as custom', () => {
		const { container } = render(ColorPicker, { value: '#123456' });
		expect(container.querySelector('.swatch.custom').classList).toContain(
			'selected'
		);
	});

	it('sets the color when a preset is clicked', async () => {
		const { container } = render(ColorPicker, { value: '' });
		const red = container.querySelector('[aria-label="#db2828"]');

		await fireEvent.click(red);

		expect(currentValue(container)).toBe('#db2828');
	});

	it('clears the color when None is clicked', async () => {
		const { container } = render(ColorPicker, { value: '#db2828' });

		await fireEvent.click(container.querySelector('.swatch.none'));

		expect(hexField(container).value).toBe('');
	});

	it('commits a valid hex on blur', async () => {
		const { container } = render(ColorPicker, { value: '' });
		const field = hexField(container);

		await fireEvent.input(field, { target: { value: '#21BA45' } });
		await fireEvent.blur(field);

		expect(currentValue(container)).toBe('#21ba45');
	});

	it('normalizes shorthand and a missing hash', async () => {
		const { container } = render(ColorPicker, { value: '' });
		const field = hexField(container);

		await fireEvent.input(field, { target: { value: 'd22' } });
		await fireEvent.blur(field);

		expect(currentValue(container)).toBe('#dd2222');
	});

	it('commits on Enter without waiting for blur', async () => {
		const { container } = render(ColorPicker, { value: '' });
		const field = hexField(container);

		await fireEvent.input(field, { target: { value: '#00b5ad' } });
		await fireEvent.keyDown(field, { key: 'Enter' });

		expect(currentValue(container)).toBe('#00b5ad');
	});

	it('canonicalizes text that parses to the color already set', async () => {
		const { container } = render(ColorPicker, { value: '#db2828' });
		const field = hexField(container);

		await fireEvent.input(field, { target: { value: 'DB2828' } });
		await fireEvent.blur(field);

		expect(field.value).toBe('#db2828');
	});

	it('silently discards unparseable text and snaps back', async () => {
		const { container } = render(ColorPicker, { value: '#db2828' });
		const field = hexField(container);

		await fireEvent.input(field, { target: { value: 'not a color' } });
		await fireEvent.blur(field);

		expect(currentValue(container)).toBe('#db2828');
		expect(field.value).toBe('#db2828');
	});

	it('leaves the color alone while a partial hex is being typed', async () => {
		const { container } = render(ColorPicker, { value: '#db2828' });

		await fireEvent.input(hexField(container), { target: { value: '#21b' } });

		expect(currentValue(container)).toBe('#db2828');
	});

	it('clears the color when the hex field is emptied', async () => {
		const { container } = render(ColorPicker, { value: '#db2828' });
		const field = hexField(container);

		await fireEvent.input(field, { target: { value: '' } });
		await fireEvent.blur(field);

		expect(container.querySelector('.swatch.none').classList).toContain(
			'selected'
		);
	});
});
