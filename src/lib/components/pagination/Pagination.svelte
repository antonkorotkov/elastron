<script>
	/**
	 * @typedef {Object} Props
	 * @property {number} [current_page]
	 * @property {number} [total_items]
	 * @property {number} [items_per_page]
	 * @property {boolean} [disable]
	 * @property {number} [offset]
	 * @property {string} [className]
	 */

	/** @type {Props} */
	let {
		current_page = $bindable(0),
		total_items = 0,
		items_per_page = 10,
		disable = false,
		offset = 0,
		className = '',
		change,
	} = $props()

	let page = $derived(current_page + 1)
	let total_pages = $derived(
		total_items > 0 ? Math.ceil(total_items / items_per_page) : 0
	)

	let prevDisabled = $derived(disable || current_page == 0)
	let nextDisabled = $derived(disable || current_page == total_pages - 1)

	let firstDisabled = $derived(prevDisabled)
	let lastDisabled = $derived(nextDisabled)

	let shouldDisplay = $derived(
		total_items > items_per_page &&
			!isNaN(current_page) &&
			page <= total_pages &&
			offset % items_per_page == 0
	)

	const onClickPrev = () => {
		if (prevDisabled) return
		change(--current_page)
	}

	const onClickNext = () => {
		if (nextDisabled) return
		change(++current_page)
	}

	const onClickFirst = () => {
		if (prevDisabled) return
		change((current_page = 0))
	}

	const onClickLast = () => {
		if (nextDisabled) return
		change((current_page = total_pages - 1))
	}
</script>

{#if shouldDisplay}
	Page {page} of {total_pages}
	<div class="ui pagination menu {className}">
		<button
			aria-label="First"
			class="mini ui button icon item"
			class:disabled={firstDisabled}
			onclick={onClickFirst}
		>
			<i class="angle double left icon"></i>
		</button>
		<button
			aria-label="Previous"
			class="mini ui button icon item"
			class:disabled={prevDisabled}
			onclick={onClickPrev}
		>
			<i class="left chevron icon"></i>
		</button>
		<button
			aria-label="Next"
			class="mini ui button icon item"
			class:disabled={nextDisabled}
			onclick={onClickNext}
		>
			<i class="right chevron icon"></i>
		</button>
		<button
			aria-label="Last"
			class="mini ui button icon item"
			class:disabled={lastDisabled}
			onclick={onClickLast}
		>
			<i class="angle double right icon"></i>
		</button>
	</div>
{/if}

<style>
	.pagination {
		margin-left: 1rem !important;
	}

	.menu.mini .item {
		font-size: 0.6rem;
	}
</style>
