<script>
  import { useStoreon } from '@storeon/svelte'
  import { isThemeToggleChecked } from '../../../utils/helpers'
  import LogFilterCheckbox from './LogFilterCheckbox.svelte'

  const { dispatch, app, importExport } = useStoreon('app', 'importExport')

  const onFilterChange = (checked, value) => {
    checked
      ? dispatch('ie/logFilter/on', value)
      : dispatch('ie/logFilter/off', value)
  }

  $: inverted = isThemeToggleChecked($app.theme)
</script>

<div class="ui form" class:inverted>
  <div class="fields">
    <div class="field">
      <LogFilterCheckbox
        label="Info"
        onChange={e => onFilterChange(e.target.checked, 'info')}
        checked={$importExport.logFilter.includes('info')}
        disabled={$importExport.logFilter.length === 1 &&
          $importExport.logFilter.includes('info')}
      />
    </div>

    <div class="field">
      <LogFilterCheckbox
        label="Verbose"
        onChange={e => onFilterChange(e.target.checked, 'verbose')}
        checked={$importExport.logFilter.includes('verbose')}
        disabled={$importExport.logFilter.length === 1 &&
          $importExport.logFilter.includes('verbose')}
      />
    </div>

    <div class="field">
      <LogFilterCheckbox
        label="Error"
        onChange={e => onFilterChange(e.target.checked, 'error')}
        checked={$importExport.logFilter.includes('error')}
        disabled={$importExport.logFilter.length === 1 &&
          $importExport.logFilter.includes('error')}
      />
    </div>
  </div>
</div>
