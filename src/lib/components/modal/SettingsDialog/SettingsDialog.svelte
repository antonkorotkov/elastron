<script>
	import { getContext } from 'svelte'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../../utils/helpers'
	import { settingsSections } from './sections.js'

	/**
	 * @typedef {Object} Section
	 * @property {string} id
	 * @property {string} title
	 * @property {any} component
	 */

	/** @type {{ sections?: Section[], initialSection?: string }} */
	let { sections = settingsSections, initialSection } = $props()

	const { app } = useStoreon('app')
	const { close } = getContext('modal-window')

	const firstId = () =>
		sections.some(section => section.id === initialSection)
			? initialSection
			: sections[0]?.id

	let activeId = $state(firstId())

	// Each section edits its own draft and exposes save(); Save commits them
	// all, and Cancel, Escape, or a click outside discards them, as in the
	// app's other dialogs.
	let sectionRefs = $state({})

	const saveAll = () => {
		for (const section of sections) sectionRefs[section.id]?.save?.()
		close()
	}

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="ui header">Settings</div>

<div class="content">
	<div class="ui grid">
		<div class="four wide column">
			<div
				class="ui vertical fluid pointing menu"
				class:inverted
				role="tablist"
				aria-orientation="vertical"
			>
				{#each sections as section (section.id)}
					<button
						type="button"
						class="item"
						class:active={section.id === activeId}
						role="tab"
						id="settings-tab-{section.id}"
						aria-selected={section.id === activeId}
						aria-controls="settings-panel-{section.id}"
						onclick={() => (activeId = section.id)}
					>
						{section.title}
					</button>
				{/each}
			</div>
		</div>
		<div class="twelve wide stretched column">
			<!--
				Every section stays mounted and only the active one is shown, so
				switching tabs never discards another section's in-progress input.
			-->
			{#each sections as section (section.id)}
				<div
					role="tabpanel"
					id="settings-panel-{section.id}"
					aria-labelledby="settings-tab-{section.id}"
					hidden={section.id !== activeId}
				>
					<section.component bind:this={sectionRefs[section.id]} />
				</div>
			{/each}
		</div>
	</div>
</div>

<div class="actions">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="ui black deny button right" class:inverted onclick={close} role="button" tabindex="0">
		Cancel
	</div>
	<button type="button" class="ui green right button" class:inverted onclick={saveAll}>
		Save
	</button>
</div>

<style>
	.menu .item {
		width: 100%;
		border: none;
		text-align: left;
		font: inherit;
		cursor: pointer;
	}
</style>
