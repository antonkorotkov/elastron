<script>
  export let containerStyle = ''
  export let allowClear = true
  export let isDisabled = false
  export let currentlySelected
  export let onSelect = () => {}
  export let onClear = () => {}

  import { useStoreon } from '@storeon/svelte'
  import AdvancedDropdown from './AdvancedDropdown.svelte'

  const { history } = useStoreon('history')
</script>

<div class="connection-selector" style={containerStyle}>
  <AdvancedDropdown
    isClearable={allowClear}
    isCreatable={false}
    {isDisabled}
    items={$history.connection.map((value, index) => ({
      value: index,
      label: value.name,
    }))}
    selectedValue={currentlySelected}
    {onClear}
    {onSelect}
    placeholder="Connection..."
  />
</div>
