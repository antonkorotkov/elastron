<script>
	import { createEventDispatcher } from 'svelte'
	const trigger = createEventDispatcher()

	export let current_page = 0
	export let total_items = 0
	export let items_per_page = 10
	export let disable = false
	export let offset = 0
	export let className = ''

	$: page = current_page + 1
	$: total_pages = total_items > 0 ? Math.ceil(total_items / items_per_page) : 0

	$: prevDisabled = disable || current_page == 0
	$: nextDisabled = disable || current_page == total_pages - 1

	$: firstDisabled = prevDisabled
	$: lastDisabled = nextDisabled

	$: shouldDisplay =
		total_items > items_per_page &&
		!isNaN(current_page) &&
		page <= total_pages &&
		offset % items_per_page == 0

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
			class="icon item"
			class:disabled={firstDisabled}
			on:click={onClickFirst}
			href
		>
			<i class="angle double left icon" />
		</a>
		<a
			class="icon item"
			class:disabled={prevDisabled}
			on:click={onClickPrev}
			href
		>
			<i class="left chevron icon" />
		</a>
		<a
			class="icon item"
			class:disabled={nextDisabled}
			on:click={onClickNext}
			href
		>
			<i class="right chevron icon" />
		</a>
		<a
			class="icon item"
			class:disabled={lastDisabled}
			on:click={onClickLast}
			href
		>
			<i class="angle double right icon" />
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
