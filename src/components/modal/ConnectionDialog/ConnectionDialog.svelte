<script>
  import { useStoreon } from '@storeon/svelte'
  import { getContext } from 'svelte'
  import { blur } from 'svelte/transition'

  import API from '../../../api/elasticsearch'

  const { dispatch, connection } = useStoreon('connection')

  let form;
  let host = $connection.host
  let port = $connection.port
  let user = $connection.user
  let password = $connection.password
  let useAuth = $connection.useAuth

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
      const api = new API({host, port, useAuth, user, password})
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
    dispatch('connection/save', {host, port, useAuth, user, password})
    close()
  }
</script>

<div class="header">
  Connection Settings
</div>

<div class="content">
  <form class="ui form" on:submit|preventDefault={save} id="connection-form">
    <div class="fields">
      <div class="twelve wide field">
        <label for="host">Host</label>
        <input type="url" id="host" on:change={e => host = e.target.value} value={$connection.host} />
      </div>
      <div class="four wide field">
        <label for="port">Port</label>
        <input type="number" id="port" on:change={e => port = e.target.value} value={$connection.port} />
      </div>
    </div>
    <div class="field">
      <div class="ui checkbox">
        <input id="auth" type="checkbox" bind:checked={useAuth} />
        <label for="auth">Authentication</label>
      </div>
    </div>
    {#if useAuth}
      <div transition:blur class="fields">
        <div class="eight wide field">
          <label for="user">User</label>
          <input required={useAuth} type="text" id="user" on:change={e => user = e.target.value} value={$connection.user} />
        </div>
        <div class="eight wide field">
          <label for="password">Password</label>
          <input required={useAuth} type="text" id="password" on:change={e => password = e.target.value} value={$connection.password} />
        </div>
      </div>
    {/if}
  </form>
</div>

<div class="actions">
  <div class="ui black deny button right" on:click={_onCancel}>
    Cancel
  </div>
  <div class="ui right button" on:click={testConnection}>
    Test
  </div>
  <button type="submit" class="ui positive right button" form="connection-form">
    Save
  </button>
</div>