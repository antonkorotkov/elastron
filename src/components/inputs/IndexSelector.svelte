<script>
  export let containerStyle = ''
  export let styles = 'height:36px;background:transparent;'
  export let allowCustom = false
  export let allowClear = true
  export let isDisabled = false
  export let currentlySelected
  export let inverted = false
  export let onSelect = () => {}
  export let onClear = () => {}

  import Select from 'svelte-select'
  import { useStoreon } from '@storeon/svelte'

  const { indices } = useStoreon('indices')

  $: items = $indices.data.map(
    item =>
      item[
        $indices.columns.reduce(
          (i, item, index) => (item === 'index' ? index : i),
          0
        )
      ]
  )
</script>

<div class="index-selector" class:inverted style={containerStyle}>
  <Select
    isClearable={allowClear}
    inputStyles={styles}
    {items}
    isCreatable={allowCustom}
    selectedValue={currentlySelected}
    {isDisabled}
    on:select={onSelect}
    on:clear={onClear}
  />

  <style>
    .inverted .index-selector .selection {
      color: black;
    }
  </style>
</div>

<style>
  .index-selector {
    --height: 38px;
  }
  .inverted {
    --listBackground: black;
    --itemHoverBG: rgb(22, 22, 22);
  }
</style>
