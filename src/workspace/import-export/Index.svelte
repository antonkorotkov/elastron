<script>
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '../../utils/helpers'
	import FileSelector from './components/FileSelector.svelte'
	import DirSelector from './components/DirSelector.svelte'
	import IndexSelector from '../../components/inputs/IndexSelector.svelte'
	import Options from './components/Options.svelte'
	import RemoteIndexSelector from './components/RemoteIndexSelector.svelte'
	import TypeSelector from './components/TypeSelector.svelte'
	import Log from './components/Log.svelte'

	const { dispatch, app, importExport, connection, history } = useStoreon(
		'app',
		'importExport',
		'connection',
		'history'
	)

	let advancedOptionsActive = $state(false)

	const onRunClick = () =>
		dispatch('ie/run', {
			importExport: $importExport,
			connection: $connection,
			connections: $history.connection,
		})

	const onSourceFileSelected = result => {
		const { canceled, filePaths } = result
		if (!canceled) dispatch('ie/input/file', filePaths[0])
	}

	const onDestinationDirSelected = result => {
		const { canceled, filePaths } = result
		if (!canceled) dispatch('ie/output/file', filePaths[0])
	}

	let canRun = $derived(() => {
		if ($importExport.isRunning) return false

		if (
			$importExport.input.type === 'index' &&
			$importExport.output.type === 'index' &&
			($importExport.input.index === $importExport.output.index ||
				!$importExport.input.index ||
				!$importExport.output.index)
		) {
			return false
		}

		if (
			($importExport.input.type === 'file' && !$importExport.input.file) ||
			($importExport.output.type === 'file' && !$importExport.output.file)
		) {
			return false
		}

		if (
			($importExport.input.type === 'remote-index' &&
				!$importExport.input.index) ||
			($importExport.output.type === 'remote-index' &&
				!$importExport.output.index)
		) {
			return false
		}

		if (
			($importExport.input.type === 'index' && !$importExport.input.index) ||
			($importExport.output.type === 'index' && !$importExport.output.index)
		) {
			return false
		}

		if (
			$importExport.input.type === 'remote-index' &&
			$importExport.output.type === 'remote-index' &&
			$importExport.input.connection === $importExport.output.connection &&
			$importExport.input.index === $importExport.output.index
		) {
			return false
		}

		if (
			($importExport.input.type === 'manual' && !$importExport.input.address) ||
			($importExport.output.type === 'manual' && !$importExport.output.address)
		) {
			return false
		}

		return true
	})

	let inverted = $derived(isThemeToggleChecked($app.theme))
</script>

<div class="ui grid">
	<div class="seven wide column">
		<div class="ui segment" class:inverted>
			<div class="ui form" class:inverted>
				<h4 class="ui dividing header" class:inverted>Input</h4>
				<div class="fields">
					<div class="four wide field">
						<label for="input-select">Type</label>
						<TypeSelector
							direction="input"
							isFileDisabled={$importExport.output.type === 'file'}
						/>
					</div>
					<div class="twelve wide themed field">
						<label for="input">Source</label>
						{#if $importExport.input.type === 'file'}
							<FileSelector
								currentlySelected={$importExport.input.file}
								selectedCallback={onSourceFileSelected}
							/>
						{:else if $importExport.input.type === 'index'}
							<IndexSelector
								currentlySelected={$importExport.input.index}
								onSelect={e => dispatch('ie/input/index', e.detail.value)}
								onClear={() => dispatch('ie/input/index', null)}
							/>
						{:else if $importExport.input.type === 'remote-index'}
							<RemoteIndexSelector direction="input" />
						{:else if $importExport.input.type === 'manual'}
							<input
								class="ui input"
								placeholder="Input address..."
								onchange={e => dispatch('ie/input/address', e.target.value)}
								value={$importExport.input.address}
							/>
						{/if}
					</div>
				</div>
				<h4 class="ui dividing header" class:inverted>Output</h4>
				<div class="fields">
					<div class="four wide field">
						<label for="output-select">Type</label>
						<TypeSelector
							direction="output"
							isFileDisabled={$importExport.input.type === 'file'}
						/>
					</div>
					<div class="twelve wide themed field">
						<label for="output">Destination</label>
						{#if $importExport.output.type === 'file'}
							<DirSelector
								currentlySelected={$importExport.output.file}
								selectedCallback={onDestinationDirSelected}
							/>
						{:else if $importExport.output.type === 'index'}
							<IndexSelector
								allowCustom={true}
								currentlySelected={$importExport.output.index}
								onSelect={e => dispatch('ie/output/index', e.detail.value)}
								onClear={() => dispatch('ie/output/index', null)}
							/>
						{:else if $importExport.output.type === 'remote-index'}
							<RemoteIndexSelector direction="output" />
						{:else if $importExport.output.type === 'manual'}
							<input
								class="ui input"
								placeholder="Output address..."
								onchange={e => dispatch('ie/output/address', e.target.value)}
								value={$importExport.output.address}
							/>
						{/if}
					</div>
				</div>
				<div
					class="ui accordion field"
					class:inverted
					class:active={advancedOptionsActive}
				>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="title"
						class:active={advancedOptionsActive}
						onclick={() => (advancedOptionsActive = !advancedOptionsActive)}
						role="button"
						tabindex="0"
					>
						<i class="icon dropdown"></i>
						Advanced Options
						<a
							aria-label="Elasticdump options help"
							class="help-link"
							title="Elasticdump options help"
							href="https://www.npmjs.com/package/elasticdump#options"
							target="_blank"
						>
							<i class="info circle icon"></i>
						</a>
					</div>
					<div class="content" class:active={advancedOptionsActive}>
						<Options />
					</div>
				</div>
				<div class="ui left action input">
					<button
						class="green ui button"
						class:inverted
						class:loading={$importExport.isRunning}
						onclick={onRunClick}
						disabled={!canRun()}>Run</button
					>
					<select
						class="dump-type-dropdown"
						onchange={e => dispatch('ie/type', e.target.value)}
					>
						<option
							value="settings"
							selected={$importExport.type === 'settings'}>Settings</option
						>
						<option
							value="analyzer"
							selected={$importExport.type === 'analyzer'}>Analyzer</option
						>
						<option value="data" selected={$importExport.type === 'data'}
							>Data</option
						>
						<option value="mapping" selected={$importExport.type === 'mapping'}
							>Mapping</option
						>
					</select>
				</div>
			</div>
		</div>
	</div>
	<div class="nine wide column">
		<div class="ui segment" class:inverted>
			<Log />
		</div>
	</div>
</div>

<style>
	.ui.form .action .dump-type-dropdown {
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}
</style>
