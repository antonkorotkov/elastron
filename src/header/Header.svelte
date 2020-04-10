<script>
	import ConnectionDialog from '../components/modal/ConnectionDialog/ConnectionDialog.svelte'

	import { getContext } from 'svelte';

	const { open } = getContext('modal-window');

  const showConnectionDialog = () => {
		open(
			ConnectionDialog
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
			Connection
		</a>
	</div>
</header>