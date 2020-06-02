<script>
  export let cell = ''
  export let i = 0
  export let columns

  import { getContext } from 'svelte'
  import ViewAliasFilterDialog from '../../../components/modal/ViewAliasFilterDialog/ViewAliasFilterDialog.svelte'

  const { open } = getContext('modal-window')

  const onViewFilterClick = () => {
    open(ViewAliasFilterDialog, { filter: cell })
  }
</script>

{#if columns[i] === 'Filter'}
  {#if cell.length}
    {`${cell.slice(0, 50)} ...`}
    <button class="mini ui primary basic button" on:click={onViewFilterClick}>
      View
    </button>
  {/if}
{:else if columns[i] === 'Actions'}
  <button class="mini ui primary basic button">Update</button>
  <button class="mini ui negative basic button">Delete</button>
{:else}{cell}{/if}
