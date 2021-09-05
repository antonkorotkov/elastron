<script>
  import { useStoreon } from '@storeon/svelte'
  import { isThemeToggleChecked } from '../../utils/helpers'
  import FileSelector from './components/FileSelector.svelte'
  import DirSelector from './components/DirSelector.svelte'
  import IndexSelector from '../../components/inputs/IndexSelector.svelte'
  import Options from './components/Options.svelte'
  import RemoteIndexSelector from './components/RemoteIndexSelector.svelte'
  import TypeSelector from './components/TypeSelector.svelte'

  const { dispatch, app, importExport } = useStoreon('app', 'importExport')

  let advancedOptionsActive = false

  const onRunClick = () => dispatch('ie/run')

  const onSourceFileSelected = result => {
    const { canceled, filePaths } = result
    if (!canceled) dispatch('ie/input/file', filePaths[0])
  }

  const onDestinationDirSelected = result => {
    const { canceled, filePaths } = result
    if (!canceled) dispatch('ie/output/file', filePaths[0])
  }

  $: canRun = () => {
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

    return true
  }

  $: inverted = isThemeToggleChecked($app.theme)
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
                currentlySelected={$importExport.output.index}
                onSelect={e => dispatch('ie/output/index', e.detail.value)}
                onClear={e => dispatch('ie/output/index', null)}
              />
            {:else if $importExport.output.type === 'remote-index'}
              <RemoteIndexSelector direction="output" />
            {/if}
          </div>
        </div>
        <div
          class="ui accordion field"
          class:inverted
          class:active={advancedOptionsActive}
        >
          <div
            class="title"
            class:active={advancedOptionsActive}
            on:click={() => (advancedOptionsActive = !advancedOptionsActive)}
          >
            <i class="icon dropdown" />
            Advanced Options
          </div>
          <div class="content" class:active={advancedOptionsActive}>
            <Options />
          </div>
        </div>
        <button
          class="green ui button"
          class:inverted
          class:loading={$importExport.isRunning}
          on:click={onRunClick}
          disabled={!canRun()}>Run</button
        >
      </div>
    </div>
  </div>
  <div class="nine wide column">
    <div class="ui segment" class:inverted>Test</div>
  </div>
</div>
