<script>
	import pkg from '../../../package.json'
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
		<div class="six wide column left aligned">
			<span>v{pkg.version}</span>
			<span>
				Made with {#if !inverted}&#x1F5A4{:else}&#x1F49B{/if} by
				<a href="https://github.com/antonkorotkov" target="_blank">
					@antonkorotkov
				</a>
			</span>
		</div>
		<div class="ten wide column right aligned control-group">
			<span class="footer-item">🇺🇦 Слава Україні!</span>
			<a
				href="https://github.com/sponsors/antonkorotkov"
				target="_blank"
				class="footer-item"
			>
				<i class="heart pink icon"></i> Sponsor me
			</a>
			<div class="ui toggle checkbox theme-toggle footer-item">
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

	.footer-item {
		margin-left: 1rem;
	}
</style>
