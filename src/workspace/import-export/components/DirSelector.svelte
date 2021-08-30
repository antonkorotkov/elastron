<script>
  export let buttonText = 'Select'
  export let inverted = false
  export let selectedCallback = () => {}
  export let currentlySelected

  import ipcRenderer from '../../../api/ipc-renderer'

  let selected = currentlySelected

  const onSelectClick = () => {
    ipcRenderer
      .run('select-dir')
      .then(result => {
        const { canceled, filePaths } = result

        if (!canceled) {
          selected = filePaths[0]
        }

        return result
      })
      .then(selectedCallback)
  }
</script>

<div class="file-selector">
  <div class="ui left action input">
    <button class="ui button" class:inverted on:click={onSelectClick}
      >{buttonText}</button
    >
    <input type="text" value={selected} readonly />
  </div>
</div>
