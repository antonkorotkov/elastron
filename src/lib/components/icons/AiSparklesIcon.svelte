<script>
	/**
	 * The "AI sparkles" mark: one large four-point star and two small ones.
	 * The bundled Semantic UI icon font has no equivalent, so it is drawn
	 * here. It fills with currentColor, so it follows the theme's text color.
	 */
	let { class: className = '', title = undefined } = $props()

	// A four-point star with concave sides, centered on (x, y) with radius r.
	const star = (x, y, r) =>
		`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`
</script>

<svg
	class="ai-sparkles {className}"
	viewBox="0 0 24 24"
	fill="currentColor"
	role={title ? 'img' : undefined}
	aria-hidden={title ? undefined : 'true'}
	aria-label={title}
	focusable="false"
>
	<path d={star(9.5, 14, 9.5)} />
	<path d={star(19.5, 4.5, 4.5)} />
	<path d={star(21, 20, 3)} />
</svg>

<style>
	.ai-sparkles {
		display: inline-block;
		width: 1.25em;
		height: 1.15em;
		vertical-align: -0.2em;
	}
</style>
