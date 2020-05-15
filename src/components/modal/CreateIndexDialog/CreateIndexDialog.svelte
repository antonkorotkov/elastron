<script>
  import { useStoreon } from '@storeon/svelte'
  import { onMount, getContext } from 'svelte'

  import API from '../../../api/elasticsearch'
  import { validateIndexName } from '../../../utils/helpers.js'

  const { close } = getContext('modal-window')
  const { dispatch, connection, indices } = useStoreon('connection', 'indices')

  export let onCancel = () => {}
  export let onOkay = () => {}

  let indexName = ''
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

  const create = async () => {
    isLoading = true

    try {
      const api = new API($connection)
      const result = await api.createIndex(indexName)

      if (result.acknowledged) {
        dispatch('notification/add', {
          type: 'success',
          message: `Index ${indexName} has been created`,
        })
        dispatch('elasticsearch/indices/fetch')
        dispatch('elasticsearch/shards/fetch')
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

  const isIndexNameAllowed = name =>
    validateIndexName(name) && !_indices.includes(name)
</script>

<div class="header">Create New Index</div>

<div class="content">
  <form
    class="ui form"
    on:submit|preventDefault={create}
    id="create-index-form">
    <div class="fields">
      <div class="sixteen wide field">
        <label for="index-name">Index Name</label>
        <input type="text" id="index-name" bind:value={indexName} />
      </div>
    </div>
  </form>
</div>

<div class="actions">
  <div class="ui black deny button right" on:click={_onCancel}>Cancel</div>
  <button
    disabled={!isIndexNameAllowed(indexName) || isLoading}
    type="submit"
    class="ui positive right button"
    class:loading={isLoading}
    form="create-index-form">
    Create
  </button>
</div>
