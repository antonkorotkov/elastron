<script>
  import { useStoreon } from '@storeon/svelte'

  export let direction
  export let isFileDisabled = false

  const { dispatch, importExport } = useStoreon('importExport')

  const onChange = e => {
    dispatch(`ie/${direction}/reset`)
    dispatch(`ie/${direction}/type`, e.target.value)
  }
</script>

<select
  value={$importExport[direction].type}
  on:change={onChange}
  id="{direction}-select"
>
  <option value="file" disabled={isFileDisabled}>File</option>
  <option value="index">Index</option>
  <option value="remote-index">Remote Index</option>
  <option value="manual">Manual</option>
</select>
