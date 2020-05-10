<script>
  import JSONEditor from 'jsoneditor'
  import { onMount, onDestroy, afterUpdate } from 'svelte'
  import { useStoreon } from '@storeon/svelte'
  import get from 'lodash/get'

  const { dispatch, index } = useStoreon('index')

  let indexPreviewEditor, ipEditor

  onMount(() => {
    if (indexPreviewEditor) {
      ipEditor = new JSONEditor(indexPreviewEditor, {
        mode: 'tree',
        onEditable: () => false,
      })
    }

    if (!$index.info[$index.selected]) dispatch('elasticsearch/index/fetch')
  })

  afterUpdate(() => {
    if (!$index.info[$index.selected]) dispatch('elasticsearch/index/fetch')

    const info = get($index.info, [$index.selected, $index.selected], false)

    if (info) ipEditor.update(info)
  })

  onDestroy(() => {
    if (ipEditor) {
      ipEditor.destroy()
    }
  })
</script>

<div id="index-preview" bind:this={indexPreviewEditor} />
