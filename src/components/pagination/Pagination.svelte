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
</script>

<style>
  .pagination {
    margin-left: 1rem !important;
  }

  .menu.mini {
    font-size: 0.6rem;
  }
</style>

{#if shouldDisplay}
  Page {page} of {total_pages}
  <div class="ui pagination menu {className}">
    <a
      class="icon item"
      class:disabled={prevDisabled}
      on:click={onClickPrev}
      href="javascript:;">
      <i class="left chevron icon" />
    </a>
    <a
      class="icon item"
      class:disabled={nextDisabled}
      on:click={onClickNext}
      href="javascript:;">
      <i class="right chevron icon" />
    </a>
  </div>
{/if}
