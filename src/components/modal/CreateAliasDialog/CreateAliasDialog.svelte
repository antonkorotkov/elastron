<script>
  export let aliases = {}

  import { useStoreon } from '@storeon/svelte'
  import JSONEditor from 'jsoneditor'
  import { getContext, onMount, onDestroy } from 'svelte'
  import get from 'lodash/get'

  import API from '../../../api/elasticsearch'

  const { dispatch, connection, index } = useStoreon('connection', 'index')

  export let onCancel = () => {}
  export let onOkay = () => {}

  let aliasName = '',
    indexRouting = '',
    searchRouting = '',
    isWriteIndex = false,
    canSave = true,
    filterEditor,
    fEditor,
    isLoading = false

  const { close } = getContext('modal-window')

  const _onCancel = () => {
    onCancel()
    close()
  }

  const _onOkay = () => {
    onOkay(value)
    close()
  }

  const save = async () => {
    isLoading = true

    try {
      const api = new API($connection)
      const result = await api.createIndexAlias($index.selected, aliasName, {
        filter: fEditor.get(),
        is_write_index: isWriteIndex,
        index_routing: indexRouting,
        search_routing: searchRouting,
      })

      if (result.acknowledged) {
        dispatch('notification/add', {
          type: 'success',
          message: `Alias ${aliasName} has been created`,
        })
        dispatch('elasticsearch/index/fetch')
        close()
      } else {
        dispatch('notification/add', {
          type: 'error',
          message: `Something went wrong while creating the index`,
        })
      }
    } catch (e) {
      dispatch('notification/add', {
        type: 'error',
        message: e.message,
      })
    }

    isLoading = false
  }

  const isAliasNameAllowed = name => {
    if (!name.length) return false
    return !get(aliases, name, false)
  }

  onMount(() => {
    if (filterEditor) {
      fEditor = new JSONEditor(filterEditor, {
        mode: 'code',
        onChange: () => {
          try {
            fEditor.get()
            canSave = true
          } catch (e) {
            canSave = false
          }
        },
      })
    }
  })

  onDestroy(() => {
    if (fEditor) {
      fEditor.destroy()
    }
  })
</script>

<div class="header">Create New Alias</div>

<div class="content">
  <form class="ui form" on:submit|preventDefault={save} id="alias-form">
    <div class="field">
      <label for="alias-name">Alias Name</label>
      <input type="text" id="alias-name" bind:value={aliasName} />
    </div>
    <div class="field">
      <label for="index-routing">Index Routing</label>
      <input type="text" id="index-routing" bind:value={indexRouting} />
    </div>
    <div class="field">
      <label for="search-routing">Search Routing</label>
      <input type="text" id="search-routing" bind:value={searchRouting} />
    </div>
    <div class="field">
      <div class="ui checkbox">
        <input
          id="is-write-index"
          type="checkbox"
          bind:checked={isWriteIndex} />
        <label for="is-write-index">Is Write Index</label>
      </div>
    </div>
    <div class="field">
      <div id="filter-editor" bind:this={filterEditor} />
    </div>
  </form>
</div>

<div class="actions">
  <div
    class="ui black deny right button"
    disabled={isLoading}
    on:click={_onCancel}>
    Cancel
  </div>
  <button
    type="submit"
    class="ui positive right button"
    class:loading={isLoading}
    form="alias-form"
    disabled={!isAliasNameAllowed(aliasName) || !canSave || isLoading}>
    Create
  </button>
</div>
