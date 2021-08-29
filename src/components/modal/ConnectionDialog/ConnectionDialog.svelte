<script>
  import { useStoreon } from '@storeon/svelte'
  import { getContext } from 'svelte'

  import API from '../../../api/elasticsearch'
  import { isThemeToggleChecked } from '../../../utils/helpers'

  const { dispatch, connection, history, app } = useStoreon(
    'connection',
    'history',
    'app'
  )

  const currentConnection = { ...$connection }

  export let onCancel = () => {}
  export const onOkay = () => {}

  const { close } = getContext('modal-window')

  const _onCancel = () => {
    try {
      dispatch('connection/update', currentConnection || {})
      onCancel()
      close()
    } catch (e) {
      dispatch('notification/add', {
        type: 'error',
        message: e.message,
      })
    }
  }

  const deleteConnection = () => {
    try {
      dispatch('history/connection/delete', $connection)
      dispatch('connection/update', $history.connection[0] || [])
    } catch (e) {
      dispatch('notification/add', {
        type: 'error',
        message: e.message,
      })
    }
  }

  const testConnection = async () => {
    try {
      const api = new API($connection)
      const { success, message } = await api.test()

      dispatch('notification/add', {
        type: success ? 'success' : 'error',
        message,
      })
    } catch (e) {
      dispatch('notification/add', {
        type: 'error',
        message: e.message,
      })
    }
  }

  const save = () => {
    if (!$connection.useAuth) {
      dispatch('connection/update', {
        user: '',
        password: '',
      })
    }
    dispatch('connection/save', close)
  }

  const onClearHistoryClick = () => {
    dispatch('history/connection/clear')
  }

  const onPreviousChange = e => {
    const index = e.target.value
    if (index >= 0) {
      dispatch('connection/update', $history.connection[index])
    } else {
      dispatch('connection/clear')
    }
  }

  $: inverted = isThemeToggleChecked($app.theme)
</script>

<div class="ui header">Connection Settings</div>

<div class="content">
  {#if $history.connection.length}
    <div class="ui form" class:inverted>
      <div class="fields">
        <div class="sixteen wide field">
          <label for="previous">Previous</label>
          <div class="ui input">
            <select
              id="previous"
              class="ui dropdown"
              on:change={onPreviousChange}
            >
              <option value="-2">Select Connection</option>
              <option value="-1">New Connection</option>
              {#if $history.connection.length}
                {#each $history.connection as connection, i}
                  <option value={i}>
                    {#if connection.name}
                      {connection.name}
                    {:else}
                      {connection.host}{connection.port
                        ? `:${connection.port}`
                        : ''}
                    {/if}
                  </option>
                {/each}
              {/if}
            </select>
            <div
              class="ui button"
              class:inverted
              on:click={onClearHistoryClick}
            >
              Clear
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
  <form
    class="ui form"
    class:inverted
    on:submit|preventDefault={save}
    id="connection-form"
  >
    <div class="fields">
      <div class="sixteen wide field">
        <label for="name">Name</label>
        <input
          type="text"
          id="name"
          required={true}
          on:change={e =>
            dispatch('connection/update', {
              name: e.target.value,
            })}
          maxlength="32"
          value={$connection.name || ''}
        />
      </div>
    </div>
    <div class="fields">
      <div class="twelve wide field">
        <label for="host">Host</label>
        <input
          type="url"
          id="host"
          required={true}
          on:change={e =>
            dispatch('connection/update', {
              host: e.target.value,
            })}
          value={$connection.host}
        />
      </div>
      <div class="four wide field">
        <label for="port">Port</label>
        <input
          type="number"
          id="port"
          on:change={e =>
            dispatch('connection/update', {
              port: e.target.value,
            })}
          value={$connection.port}
        />
      </div>
    </div>
    <div class="field">
      <div class="ui checkbox">
        <input
          id="auth"
          type="checkbox"
          checked={$connection.useAuth}
          on:change={e =>
            dispatch('connection/update', {
              useAuth: e.target.checked,
            })}
        />
        <label for="auth">Authentication</label>
      </div>
    </div>
    {#if $connection.useAuth}
      <div class="fields">
        <div class="eight wide field">
          <label for="user">User</label>
          <input
            required={$connection.useAuth}
            type="text"
            id="user"
            on:change={e =>
              dispatch('connection/update', {
                user: e.target.value,
              })}
            value={$connection.user}
          />
        </div>
        <div class="eight wide field">
          <label for="password">Password</label>
          <input
            required={$connection.useAuth}
            type="password"
            id="password"
            on:change={e =>
              dispatch('connection/update', {
                password: e.target.value,
              })}
            value={$connection.password}
          />
        </div>
      </div>
    {/if}
  </form>
</div>

<div class="actions">
  <div class="ui black deny button right" class:inverted on:click={_onCancel}>
    Cancel
  </div>
  <div class="ui red right button" class:inverted on:click={deleteConnection}>
    Delete
  </div>
  <div class="ui right button" class:inverted on:click={testConnection}>
    Test
  </div>
  <button
    type="submit"
    class="ui green right button"
    class:inverted
    form="connection-form"
  >
    Save
  </button>
</div>

<style>
  #previous {
    margin-right: 1rem;
  }
</style>
