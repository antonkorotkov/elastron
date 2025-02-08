<script>
	import { createEventDispatcher } from 'svelte'
	const trigger = createEventDispatcher()

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
		className = ''
	} = $props();

	let page = $derived(current_page + 1)
	let total_pages = $derived(total_items > 0 ? Math.ceil(total_items / items_per_page) : 0)

	let prevDisabled = $derived(disable || current_page == 0)
	let nextDisabled = $derived(disable || current_page == total_pages - 1)

	let firstDisabled = $derived(prevDisabled)
	let lastDisabled = $derived(nextDisabled)

	let shouldDisplay =
		$derived(total_items > items_per_page &&
		!isNaN(current_page) &&
		page <= total_pages &&
		offset % items_per_page == 0)

	const onClickPrev = event => {
		if (prevDisabled) return
		trigger('prev', --current_page)
		trigger('change', current_page)
	}

	const onClickNext = event => {
		if (nextDisabled) return
		trigger('next', ++current_page)
		trigger('change', current_page)
	}

	const onClickFirst = event => {
		if (prevDisabled) return
		trigger('first', (current_page = 0))
		trigger('change', current_page)
	}

	const onClickLast = event => {
		if (nextDisabled) return
		trigger('last', (current_page = total_pages - 1))
		trigger('change', current_page)
	}
</script>

{#if shouldDisplay}
	Page {page} of {total_pages}
	<div class="ui pagination menu {className}">
		<a
			aria-label="First"
			class="icon item"
			class:disabled={firstDisabled}
			onclick={onClickFirst}
			href
		>
			<i class="angle double left icon"></i>
		</a>
		<a
			aria-label="Previous"
			class="icon item"
			class:disabled={prevDisabled}
			onclick={onClickPrev}
			href
		>
			<i class="left chevron icon"></i>
		</a>
		<a
			aria-label="Next"
			class="icon item"
			class:disabled={nextDisabled}
			onclick={onClickNext}
			href
		>
			<i class="right chevron icon"></i>
		</a>
		<a
			aria-label="Last"
			class="icon item"
			class:disabled={lastDisabled}
			onclick={onClickLast}
			href
		>
			<i class="angle double right icon"></i>
		</a>
	</div>
{/if}

<style>
	.pagination {
		margin-left: 1rem !important;
	}

	.menu.mini {
		font-size: 0.6rem;
	}
</style>
