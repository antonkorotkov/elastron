<script>
  import JSONEditor from 'jsoneditor'
  import { onMount, onDestroy, afterUpdate } from 'svelte'
  import { useStoreon } from '@storeon/svelte'
  import { routerNavigate } from '@storeon/router'
  import get from 'lodash/get'

  import API from '../../../api/elasticsearch'

  const { dispatch, index, connection, indices } = useStoreon(
    'index',
    'connection',
    'indices'
  )

  let indexPreviewEditor, ipEditor
  let isLoading = false

  onMount(() => {
    if (indexPreviewEditor) {
      ipEditor = new JSONEditor(indexPreviewEditor, {
        mode: 'tree',
        onEditable: () => false,
        onCreateMenu: () => [],
      })
    }

    if (!$index.info[$index.selected]) dispatch('elasticsearch/index/fetch')
  })

  afterUpdate(() => {
    if (!$index.info[$index.selected]) dispatch('elasticsearch/index/fetch')

    const info = get($index.info, [$index.selected, $index.selected], false)

    if (info) ipEditor.update(info)
  })

  onDestroy(() => {
    if (ipEditor) {
      ipEditor.destroy()
    }
  })

  const onDeleteIndexClick = async indexName => {
    if (
      !confirm(
        'Are you sure you want to delete the index? You will loose all index data without an ability to restore.'
      )
    )
      return

    isLoading = true

    try {
      const api = new API($connection)
      const result = await api.deleteIndex(indexName)

      if (result.acknowledged) {
        dispatch('notification/add', {
          type: 'success',
          message: `Index ${indexName} has been deleted`,
        })
        dispatch('elasticsearch/indices/fetch')
      } else {
        dispatch('notification/add', {
          type: 'error',
          message: `Something went wrong while deleting the index`,
        })
      }
    } catch (e) {
      dispatch('notification/add', {
        type: 'error',
        message: e.message,
      })
    }

    dispatch(routerNavigate, '/')
    isLoading = false
  }
</script>

<div class="ui buttons">
  <button
    class="ui negative button"
    on:click={e => onDeleteIndexClick($index.selected)}
    class:loading={isLoading}
    disabled={isLoading}>
    Delete
  </button>
</div>

<div class="ui vertical segment">
  <div id="index-preview" bind:this={indexPreviewEditor} />
</div>
