<script>
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../utils/helpers'

	let { items = $bindable([]) } = $props()

	const { app } = useStoreon('app')
	let inverted = $derived(isThemeToggleChecked($app.theme))

	function addRow() {
		items = [...items, { key: '', value: '', enabled: true }]
	}

	function deleteRow(index) {
		items = items.filter((_, i) => i !== index)
	}
</script>

<div class="kv-list">
	{#each items as item, index (index)}
		<div class="kv-row">
			<input
				type="checkbox"
				bind:checked={item.enabled}
				title="Toggle Header"
			/>
			<div class="ui input fluid" class:inverted>
				<input
					type="text"
					placeholder="Key (e.g., Authorization)"
					bind:value={item.key}
				/>
			</div>
			<div class="ui input fluid" class:inverted>
				<input type="text" placeholder="Value" bind:value={item.value} />
			</div>
			<button
				class="ui icon button basic"
				class:inverted
				onclick={() => deleteRow(index)}
				aria-label="Delete"
			>
				<i class="trash icon"></i>
			</button>
		</div>
	{/each}

	<button class="ui button compact" class:inverted onclick={addRow}>
		<i class="plus icon"></i> Add Row
	</button>
</div>

<style>
	.kv-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		overflow-y: auto;
		height: 100%;
	}
	.kv-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.kv-row input[type='checkbox'] {
		width: 1.2rem;
		height: 1.2rem;
		cursor: pointer;
	}
	.kv-row :global(.ui.input.fluid) {
		flex: 1;
	}
</style>
