<script>
  import { useStoreon } from '@storeon/svelte'
  import { getContext } from 'svelte'
  import API from '../../../api/elasticsearch'

  const { dispatch, connection } = useStoreon('connection')

  let host = $connection.host;
  let port = $connection.port;
  let test = null;
  
	export let onCancel = () => {}
	export let onOkay = () => {}

  const { close } = getContext('modal-window')
	
	const _onCancel = () => {
		onCancel();
		close();
	}
	
	const _onOkay = () => {
		onOkay(value);
		close();
  }
  
  const testConnection = async () => {
    try {
      const api = new API(`${host}:${port}`)
      test = await api.test();
    } catch (e) {
      test = {
        success: false, message: e.message
      }
    }
  }

  const save = () => {
    dispatch('connection/update', {host, port})
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
    {#if test}
    <div class="field">
      <div class="ui label" class:red={!test.success} class:green={test.success}>{test.message}</div>
    </div>
    {/if}
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