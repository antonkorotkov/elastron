<script>
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../utils/helpers'
	import { slide } from 'svelte/transition'
	import { cubicOut } from 'svelte/easing'

	const { dispatch, playground, app } = useStoreon('playground', 'app')

	let inverted = $derived(isThemeToggleChecked($app.theme))
	let builtinTemplates = $derived($playground.builtinTemplates)
	let customTemplates = $derived($playground.customTemplates)

	function selectTemplate(template) {
		dispatch('playground/loadTemplate', template)
		dispatch('playground/toggleDrawer')
	}

	function deleteTemplate(id) {
		if (confirm('Are you sure you want to delete this custom template?')) {
			dispatch('playground/deleteTemplate', id)
		}
	}
</script>

<div
	class="drawer-container"
	transition:slide={{ axis: 'x', duration: 350, easing: cubicOut }}
>
	<div class="drawer" class:inverted>
		<div class="drawer-header">
			<h3 class:inverted-text={inverted}>Templates</h3>
			<button
				class="ui icon button tiny basic"
				class:inverted
				onclick={() => dispatch('playground/toggleDrawer')}
				aria-label="Close Drawer"
			>
				<i class="close icon"></i>
			</button>
		</div>

		<div class="drawer-content">
			<h5 class="ui header section-header" class:inverted>Saved</h5>
			<div class="ui relaxed list" class:inverted>
				{#if customTemplates.length === 0}
					<div class="item empty-state" class:inverted>
						<i class="folder open outline icon"></i>
						<p>No custom templates saved yet.</p>
					</div>
				{/if}
				{#each customTemplates as template (template.id)}
					<div class="item template-item">
						<div
							class="content template-link"
							onclick={() => selectTemplate(template)}
							tabindex="0"
							role="button"
							onkeydown={e => e.key === 'Enter' && selectTemplate(template)}
						>
							<div class="action-buttons">
								<button
									class="ui icon button mini basic delete-btn"
									class:inverted
									onclick={e => {
										e.stopPropagation()
										deleteTemplate(template.id)
									}}
									aria-label={`Delete custom template ${template.name}`}
								>
									<i class="trash alternate outline icon"></i>
								</button>
							</div>
							<div class="header" class:inverted-text={inverted}>
								{template.name || 'Unnamed Template'}
							</div>
							<div class="description">
								<span class="method {template.method?.toLowerCase()}"
									>{template.method}</span
								>
								<span>{template.path}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<h5 class="ui header section-header" class:inverted>Built-in Actions</h5>
			<div class="ui relaxed list" class:inverted>
				{#each builtinTemplates as template (template.id)}
					<div class="item template-item">
						<div
							class="content template-link"
							onclick={() => selectTemplate(template)}
							tabindex="0"
							role="button"
							onkeydown={e => e.key === 'Enter' && selectTemplate(template)}
						>
							<div class="header" class:inverted-text={inverted}>
								{template.name}
							</div>
							<div class="description">
								<span class="method {template.method?.toLowerCase()}"
									>{template.method}</span
								>
								<span>{template.path}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.drawer-container {
		height: 100%;
		overflow: hidden;
		flex-shrink: 0;
	}
	.drawer {
		width: 350px;
		min-width: 350px;
		display: flex;
		flex-direction: column;
		height: 100%;
		box-shadow: 2px 0 10px rgba(0, 0, 0, 0.02);
	}
	.drawer.inverted {
		box-shadow: 2px 0 10px rgba(0, 0, 0, 0.2);
	}
	.drawer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.15rem 0;
		background: #fff;
	}
	.drawer.inverted .drawer-header {
		background: #1b1c1d;
	}
	.drawer-header h3 {
		margin: 0;
		font-size: 1.1rem;
		display: flex;
		align-items: center;
	}
	.drawer-content {
		flex: 1;
		overflow-y: auto;
	}

	/* Custom Scrollbar for Drawer */
	.drawer-content::-webkit-scrollbar {
		width: 6px;
	}
	.drawer-content::-webkit-scrollbar-track {
		background: transparent;
	}
	.drawer-content::-webkit-scrollbar-thumb {
		background: #d1d5db;
		border-radius: 10px;
	}
	.drawer.inverted .drawer-content::-webkit-scrollbar-thumb {
		background: #555;
	}

	.section-header {
		font-size: 0.85rem !important;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #888 !important;
		margin-bottom: 1rem !important;
	}

	.template-item {
		margin-bottom: 0.5rem !important;
		border: none !important;
		padding: 0 !important;
	}

	.template-link {
		cursor: pointer;
		padding: 0.8rem 1rem !important;
		border-radius: 8px;
		background: #fff;
		border: 1px solid #e5e7eb;
		transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
		display: block !important;
		position: relative;
	}
	.template-link:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
		border-color: #d1d5db;
	}
	.template-link:active {
		transform: translateY(0);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	.drawer.inverted .template-link {
		background: #1b1c1d;
		border-color: #333;
	}
	.drawer.inverted .template-link:hover {
		background: #222;
		border-color: #444;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.empty-state {
		text-align: center;
		padding: 2rem 1rem !important;
		color: #888;
		background: transparent !important;
		border: 1px dashed #d1d5db !important;
		border-radius: 8px;
		margin-bottom: 1rem;
	}
	.drawer.inverted .empty-state {
		border-color: #444 !important;
		color: #666;
	}
	.empty-state i {
		font-size: 2rem;
		margin-bottom: 0.5rem;
		opacity: 0.5;
	}

	.inverted-text {
		color: #fff !important;
	}
	.description {
		margin-top: 0.4rem !important;
		color: #666 !important;
		font-size: 0.85em !important;
		font-family: monospace;
		display: flex;
		align-items: center;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.drawer.inverted .description {
		color: #aaa !important;
	}
	.header {
		color: #333 !important;
		font-weight: 600 !important;
		font-size: 0.95em !important;
		padding-right: 2rem; /* space for the hover action */
	}
	.drawer.inverted .header {
		color: #eee !important;
	}

	/* Absolute positioned hover actions */
	.action-buttons {
		position: absolute;
		right: 0.5rem;
		top: 50%;
		transform: translateY(-50%);
		opacity: 0;
		transition: opacity 0.2s;
	}
	.template-link:hover .action-buttons {
		opacity: 1;
	}
	.delete-btn {
		margin: 0 !important;
		padding: 0.5rem !important;
	}
	.delete-btn:hover {
		color: #db2828 !important;
		background: #ffe8e6 !important;
	}
	.drawer.inverted .delete-btn:hover {
		background: #4a1919 !important;
	}

	/* HTTP Method Badges */
	.method {
		display: inline-block;
		font-size: 0.85em;
		font-weight: bold;
		padding: 0.1em 0.4em;
		border-radius: 4px;
		margin-right: 0.4em;
		text-transform: uppercase;
		background: #eee;
		color: #555;
	}
	.drawer.inverted .method {
		color: #ccc;
	}

	.method.get {
		color: #21ba45;
		background: rgba(33, 186, 69, 0.1);
	}
	.drawer.inverted .method.get {
		background: rgba(33, 186, 69, 0.25);
	}

	.method.post {
		color: #2185d0;
		background: rgba(33, 133, 208, 0.1);
	}
	.drawer.inverted .method.post {
		background: rgba(33, 133, 208, 0.25);
	}

	.method.put {
		color: #f2711c;
		background: rgba(242, 113, 28, 0.1);
	}
	.drawer.inverted .method.put {
		background: rgba(242, 113, 28, 0.25);
	}

	.method.delete {
		color: #db2828;
		background: rgba(219, 40, 40, 0.1);
	}
	.drawer.inverted .method.delete {
		background: rgba(219, 40, 40, 0.25);
	}

	.method.head {
		color: #a333c8;
		background: rgba(163, 51, 200, 0.1);
	}
	.drawer.inverted .method.head {
		background: rgba(163, 51, 200, 0.25);
	}

	.method.patch {
		color: #00b5ad;
		background: rgba(0, 181, 173, 0.1);
	}
	.drawer.inverted .method.patch {
		background: rgba(0, 181, 173, 0.25);
	}
</style>
