<script>
  import { useStoreon } from '@storeon/svelte'
  import { getContext } from 'svelte'

  import API from '../../../api/elasticsearch'

  const { dispatch, connection } = useStoreon('connection')

  let host = $connection.host
  let port = $connection.port

	export let onCancel = () => {}
	export let onOkay = () => {}

  const { close } = getContext('modal-window')
	
	const _onCancel = () => {
		onCancel();
		close();
	}
	
	const _onOkay = () => {
		onOkay(value)
		close()
  }
  
  const testConnection = async () => {
    try {
      const api = new API(`${host}:${port}`)
      const { success, message } = await api.test();

      dispatch('notification/add', {
        type: success ? 'success' : 'error', message
      })
    } catch (e) {
      dispatch('notification/add', {
        type: 'error', message: e.message
      })
    }
  }

  const save = () => {
    dispatch('connection/save', {host, port})
    close()
  }
</script>

<div class="header">
  Connection Settings
</div>

<div class="content">
  <div class="ui form">
    <div class="field">
      <label for="host">Host</label>
      <input type="text" id="host" on:change={e => host = e.target.value} value={$connection.host} />
    </div>
    <div class="field">
      <label for="port">Port</label>
      <input type="text" id="port" on:change={e => port = e.target.value} value={$connection.port} />
    </div>
  </div>
</div>

<div class="actions">
  <div class="ui black deny button right" on:click={_onCancel}>
    Cancel
  </div>
  <div class="ui right button" on:click={testConnection}>
    Test
  </div>
  <div class="ui positive right button" on:click={save}>
    Save
  </div>
</div>