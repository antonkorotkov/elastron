<script>
	import {
		CONNECTION_COLORS,
		normalizeHex,
	} from '../../utils/helpers'

	/**
	 * @typedef {Object} Props
	 * @property {string} [value] canonical lowercase `#rrggbb`, or '' for none
	 * @property {boolean} [inverted]
	 */

	/** @type {Props} */
	let { value = $bindable(''), inverted = false } = $props()

	/**
	 * The hex field holds whatever has been typed, which is not necessarily a
	 * color yet. It only reaches `value` once it parses, so a half-typed hex
	 * never repaints the app chrome. Writable derived: typing overwrites it,
	 * and it snaps back to the color whenever that changes from elsewhere —
	 * a preset, None, the native picker, or switching to another connection.
	 */
	let hexText = $derived(value)

	/** @type {HTMLInputElement} */
	let nativeInput = $state(null)

	const select = color => {
		value = color
	}

	/**
	 * Commit on blur rather than per keystroke: normalizing mid-typing would
	 * rewrite the field under the cursor. Unparseable text is silently
	 * discarded and the field snaps back to the current color.
	 */
	const commitHex = () => {
		if (hexText.trim() === '') {
			value = ''
			return
		}

		const normalized = normalizeHex(hexText)

		// Assign the field explicitly rather than leaning on the derived: when
		// the typed text parses to the color already set, `value` does not
		// change, so nothing would re-run and the field would keep showing the
		// non-canonical spelling.
		hexText = normalized ?? value
		if (normalized) value = normalized
	}

	const onHexKeydown = event => {
		if (event.key === 'Enter') {
			event.preventDefault()
			commitHex()
		}
	}

	let isCustom = $derived(!!value && !CONNECTION_COLORS.includes(value))
</script>

<div class="color-picker" class:inverted>
	<div class="swatches">
		<button
			type="button"
			class="swatch none"
			class:selected={!value}
			onclick={() => select('')}
			title="No color"
			aria-label="No color"
		></button>

		{#each CONNECTION_COLORS as color (color)}
			<button
				type="button"
				class="swatch"
				class:selected={value === color}
				style="background: {color};"
				onclick={() => select(color)}
				title={color}
				aria-label={color}
			></button>
		{/each}

		<button
			type="button"
			class="swatch custom"
			class:selected={isCustom}
			style={isCustom ? `background: ${value};` : ''}
			onclick={() => nativeInput?.click()}
			title="Custom color"
			aria-label="Custom color"
		></button>
	</div>

	<input
		class="hex-input"
		type="text"
		spellcheck="false"
		autocomplete="off"
		placeholder="#rrggbb"
		aria-label="Color hex value"
		bind:value={hexText}
		onblur={commitHex}
		onkeydown={onHexKeydown}
	/>

	<!--
		The native picker is Chromium's own widget on Windows and Linux and the
		system color panel on macOS, so its default swatch button looks
		different on each. Hide it and drive it from our own swatch instead, so
		the control is identical everywhere. It must stay in the layout —
		`display: none` stops Chromium opening the dialog at all.
	-->
	<input
		bind:this={nativeInput}
		class="native-input"
		type="color"
		tabindex="-1"
		aria-hidden="true"
		value={value || '#2185d0'}
		oninput={event => (value = event.currentTarget.value)}
	/>
</div>

<style>
	.color-picker {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.swatches {
		display: flex;
		gap: 0.35rem;
	}

	.swatch {
		width: 22px;
		height: 22px;
		padding: 0;
		border: 1px solid rgba(34, 36, 38, 0.25);
		border-radius: 4px;
		cursor: pointer;
		background: transparent;
	}

	.color-picker.inverted .swatch {
		border-color: rgba(255, 255, 255, 0.3);
	}

	.swatch.selected {
		outline: 2px solid #2185d0;
		outline-offset: 2px;
	}

	/* Diagonal slash, so "no color" reads as deliberate rather than unset. */
	.swatch.none {
		background: linear-gradient(
			to top right,
			transparent calc(50% - 1px),
			#db2828 calc(50% - 1px),
			#db2828 calc(50% + 1px),
			transparent calc(50% + 1px)
		);
	}

	.swatch.custom:not(.selected) {
		background: conic-gradient(
			#db2828,
			#fbbd08,
			#21ba45,
			#00b5ad,
			#2185d0,
			#a333c8,
			#db2828
		);
	}

	.hex-input {
		width: 110px !important;
		font-family: monospace;
	}

	.native-input {
		position: absolute;
		width: 0;
		height: 0;
		padding: 0;
		border: 0;
		opacity: 0;
		pointer-events: none;
	}
</style>
