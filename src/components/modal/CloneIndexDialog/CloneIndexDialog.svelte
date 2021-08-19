<script>
  import { useStoreon } from '@storeon/svelte'
  import { onMount, getContext } from 'svelte'

  import API from '../../../api/elasticsearch'
  import {
    isThemeToggleChecked,
    validateIndexName,
  } from '../../../utils/helpers.js'

  const { close } = getContext('modal-window')
  const { dispatch, connection, indices, index, app } = useStoreon(
    'connection',
    'indices',
    'index',
    'app'
  )

  export let onCancel = () => {}
  export let onOkay = () => {}

  let newIndex = ''
  let isLoading = false

  let _indices =
    $indices.data.map(
      item =>
        item[
          $indices.columns.reduce(
            (i, item, index) => (item === 'index' ? index : i),
            0
          )
        ]
    ) || []

  onMount(() => {
    document.getElementById('index-name').focus()
  })

  const _onCancel = () => {
    onCancel()
    close()
  }

  const _onOkay = () => {
    onOkay(value)
    close()
  }

  const clone = async () => {
    isLoading = true

    try {
      const api = new API($connection)
      const result = await api.cloneIndex($index.selected, newIndex)

      if (result.acknowledged) {
        dispatch('notification/add', {
          type: 'success',
          message: `Index ${$index.selected} has been cloned into ${newIndex}`,
        })
        dispatch('elasticsearch/indices/fetch', () =>
          dispatch('elasticsearch/index/select', newIndex)
        )
        dispatch('elasticsearch/shards/fetch')
        dispatch('elasticsearch/allocation/fetch')
        dispatch('elasticsearch/index/fetch')
        close()
      } else {
        dispatch('notification/add', {
          type: 'error',
          message: `Something went wrong while cloning the index`,
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

  const isIndexNameAllowed = name =>
    validateIndexName(name) && !_indices.includes(name)

  $: inverted = isThemeToggleChecked($app.theme)
</script>

<div class="ui header">Clone The Index</div>

<div class="content">
  <form
    class="ui form"
    class:inverted
    on:submit|preventDefault={clone}
    id="create-index-form"
  >
    <div class="fields">
      <div class="sixteen wide field">
        <label for="index-name">New Index Name</label>
        <input type="text" id="index-name" bind:value={newIndex} />
      </div>
    </div>
  </form>
</div>

<div class="actions">
  <div class="ui black deny button right" class:inverted on:click={_onCancel}>
    Cancel
  </div>
  <button
    disabled={!isIndexNameAllowed(newIndex) || isLoading}
    type="submit"
    class="ui positive right button"
    class:loading={isLoading}
    class:inverted
    form="create-index-form"
  >
    Clone
  </button>
</div>
