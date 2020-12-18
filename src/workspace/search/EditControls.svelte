<script>
  import { useStoreon } from '@storeon/svelte'

  export let canEditDoc, editor

  const { dispatch, search } = useStoreon('search')

  const saveEditDoc = method => {
    if (method === 'update')
      return () => {
        try {
          if (
            confirm(
              'Only listed fields will be updated in the document. Continue?'
            )
          )
            dispatch('search/documents/update', editor.get())
        } catch ({ message }) {
          dispatch('notification/add', {
            type: 'error',
            message,
          })
        }
      }

    if (method === 'reindex')
      return () => {
        try {
          if (
            confirm(
              'The entire document will be reindexed using listed fields. Continue?'
            )
          )
            dispatch('search/documents/reindex', editor.get())
        } catch ({ message }) {
          dispatch('notification/add', {
            type: 'error',
            message,
          })
        }
      }
  }
</script>

<style>
  .edit-doc {
    margin-bottom: 12px;
  }
</style>

<div class="ui grid">
  <div class="sixteen wide column">
    <div class="edit-doc">
      Editing: &nbsp;
      <span class="ui label">
        {$search.editDoc._type}:{$search.editDoc._id}
      </span>
      of index
      <span class="ui label">{$search.editDoc._index}</span>
      &nbsp|&nbsp;
      <span class="ui text">
        <button
          class="mini ui button green"
          disabled={!canEditDoc || $search.loading}
          on:click={saveEditDoc('update')}>
          Update
        </button>
        <button
          class="mini ui button blue"
          disabled={!canEditDoc || $search.loading}
          on:click={saveEditDoc('reindex')}>
          Reindex
        </button>
        <button
          class="mini ui button red"
          disabled={$search.loading}
          on:click={() => dispatch('search/update', { view: 'hits' })}>
          Cancel
        </button>
      </span>
    </div>
  </div>
</div>
