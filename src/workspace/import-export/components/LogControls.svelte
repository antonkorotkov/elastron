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

  const onLogsShowChange = e =>
    dispatch('ie/logsPerPage', parseInt(e.target.value))

  $: inverted = isThemeToggleChecked($app.theme)
</script>

<div class="ui grid">
  <div class="row">
    <div class="eight wide left aligned column">
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
    </div>
    <div class="eight wide right aligned column">
      <select on:change={onLogsShowChange}>
        <option value="0" selected={$importExport.logsPerPage === 0}
          >Show all</option
        >
        <option value="10" selected={$importExport.logsPerPage === 10}
          >Last 10</option
        >
        <option value="50" selected={$importExport.logsPerPage === 50}
          >Last 50</option
        >
        <option value="100" selected={$importExport.logsPerPage === 100}
          >Last 100</option
        >
        <option value="500" selected={$importExport.logsPerPage === 500}
          >Last 500</option
        >
        <option value="1000" selected={$importExport.logsPerPage === 1000}
          >Last 1000</option
        >
      </select>
    </div>
  </div>
</div>
