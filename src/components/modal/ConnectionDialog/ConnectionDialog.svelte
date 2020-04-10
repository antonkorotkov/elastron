<script>
  import { getContext } from 'svelte';
  
	export let onCancel = () => {};
	export let onOkay = () => {};

  const { close } = getContext('modal-window');
	
	let value;
	let onChange = () => {};
	
	function _onCancel() {
		onCancel();
		close();
	}
	
	function _onOkay() {
		onOkay(value);
		close();
	}
	
	$: onChange(value)
</script>

<div class="header">
  Connection Settings
</div>

<div class="content">
  <div class="ui form">
    <div class="field">
      <label for="host">Host</label>
      <input type="text" id="host" />
    </div>
    <div class="field">
      <label for="port">Port</label>
      <input type="text" id="port" />
    </div>
  </div>
</div>

<div class="actions">
  <div class="ui black deny button" on:click={_onCancel}>
    Cancel
  </div>
  <div class="ui right button">
    Test
  </div>
  <div class="ui positive right button">
    Save
  </div>
</div>