<script>
	import ConnectionDialog from '../components/modal/ConnectionDialog/ConnectionDialog.svelte'

	import { getContext } from 'svelte';

	const { open } = getContext('modal-window');

	const onCancel = (text) => {
		name = '';
		status = -1;
	}
	
	const onOkay = (text) => {
		name = text;
		status = 1;
	}

  const showConnectionDialog = () => {
		open(
			ConnectionDialog,
			{
				onCancel,
				onOkay
			}
		);
	};
</script>

<header style="height: 100px;">
  <div class="ui menu inverted attached">
		<div class="header active item yellow">
			<b>Elastron</b>
		</div>
		<a class="item" href="javascript:void(0);">
			Dashboard
		</a>
		<a class="item right" on:click={showConnectionDialog} href="javascript:void(0);">
			+ Connect
		</a>
	</div>
</header>