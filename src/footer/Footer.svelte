<script>
	import pkg from '../../package.json'
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../utils/helpers'

	const { dispatch, app } = useStoreon('app')

	const onThemeChange = isChecked => {
		const theme = isChecked ? 'dark' : 'light'
		dispatch('app/toggleTheme', theme)
	}

	let toggleChecked = $derived(isThemeToggleChecked($app.theme))
	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<footer class="ui segment" class:inverted>
	<div class="ui grid">
		<div class="twelve wide column left aligned">
			<span>Version {pkg.version}</span>
			-
			<span>
				Made with {#if !inverted}&#x1F5A4{:else}&#x1F49B{/if} by
				<a href="https://github.com/antonkorotkov" target="_blank">
					@antonkorotkov
				</a>
			</span>
			-
			<span>
				🇺🇦 Слава Україні! Смерть ворогам! Рускій воєний корабль, іді нахуй! 🇺🇦
			</span>
		</div>
		<div class="four wide column right aligned">
			<div class="ui toggle checkbox theme-toggle">
				<input
					id="theme-mode-toggler"
					type="checkbox"
					name="theme"
					onchange={e => onThemeChange(e.target.checked)}
					checked={toggleChecked}
				/>
				<label for="theme-mode-toggler">🌗</label>
			</div>
		</div>
	</div>
</footer>

<style>
	footer {
		position: fixed !important;
		bottom: 0;
		border-radius: 0 !important;
		width: 100%;
		z-index: 10;
	}

	.theme-toggle {
		font-size: 1.5rem;
		line-height: 1rem;
	}
</style>
