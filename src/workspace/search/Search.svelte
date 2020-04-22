<script>
  import isEqual from 'lodash/isEqual'
  import JSONEditor from 'jsoneditor'
  import { useStoreon } from '@storeon/svelte'
  import { onMount, onDestroy, afterUpdate } from 'svelte'

  import 'jsoneditor/dist/jsoneditor.min.css'

  const { dispatch, search, indices } = useStoreon('search', 'indices')

  let requestBodyEditor, resultsEditor
  let qEditor, rEditor

  $:  _indices = $indices.data.map(item => 
        item[$indices.columns.reduce((i, item, index) => 
          item === 'index' ? index : i, 0
        )]
      )

  const onEditorChange = () => {
    try {
      if (qEditor) {
        const requestBody = qEditor.get()
        dispatch('search/update', {requestBody})
      }
    } catch (err) {}
  }

  const onDocTypeChange = e => {
    const docType = e.target.value.trim() || '_doc'
    dispatch('search/update', {docType})
    e.target.value = docType
  }

  const onSearchRun = e => {
    dispatch('search/run')
  }

  const onStateFieldChange = data => dispatch('search/update', data)

  const onSizeChange = e => {
    const size = !e.target.value.trim() || Number(e.target.value.trim()) < 0 ? 10 : Number(e.target.value.trim())
    dispatch('search/update', {size})
    e.target.value = size
  }

  const onFromChange = e => {
    const from = !e.target.value.trim() || Number(e.target.value.trim()) < 0 ? 0 : Number(e.target.value.trim())
    dispatch('search/update', {from})
    e.target.value = from
  }

  onMount(() => {
    if (requestBodyEditor) {
      qEditor = new JSONEditor(requestBodyEditor, {
        mode: 'code',
        onChange: onEditorChange
      }, $search.requestBody)
      qEditor.aceEditor.setOptions({maxLines: 32})
    }

    if (resultsEditor) {
      rEditor = new JSONEditor(resultsEditor, {
        mode: 'tree',
        onEditable: () => false,
        onCreateMenu: (items, node) => {
          if (node.type === 'single' && node.path.length === 1) {
            return [
              {
                text: 'Edit',
                title: 'Edit the document and commit updates to the server',
                className: 'jsoneditor-type-object',
                click: () => {
                  alert('Comming soon')
                }
              },
              {
                text: 'Delete',
                title: 'Delete the document from the server',
                className: 'jsoneditor-remove',
                click: () => {
                  alert('Comming soon')
                }
              }
            ]
          }
          return []
        }
      }, $search.results)
    }
  })

  afterUpdate(() => {
    if (rEditor && !isEqual(rEditor.get(), $search.results)) {
      rEditor.set($search.results)
    }
  })

  onDestroy(() => {
    if (qEditor) {
      qEditor.destroy()
    }
    if (rEditor) {
      rEditor.destroy()
    }
  })
</script>

<style>
  .hidden {
    display: none;
  }

  label.checked {
    padding-left: 0;
  }

  .search-options input[type="number"] {
    width: 6rem !important;
  }

  .stats {
    margin-bottom: 7px;
  }
</style>

<div class="ui segments">
  <div class="ui segment">
    <div class="ui form">
      <div class="fields search-options">
        <div class="field">
          <label for="type">Search Type</label>
          <select id="type" class="ui dropdown" on:change={e => onStateFieldChange({type:e.target.value})} value={$search.type}>
            <option value="uri">URI Search</option>
            <option value="body">Request Body</option>
          </select>
        </div>
        <div class="field">
          <label for="index">Index</label>
          <select id="index" class="ui dropdown" on:change={e => onStateFieldChange({index:e.target.value})} value={$search.index}>
            <option value="_all">All</option>
            {#if _indices.length}
              {#each _indices as index}
                <option value="{index}">{index}</option>
              {/each}
            {/if}
          </select>
        </div>

        {#if $search.type === 'uri'}
          <div class="field">
            <label for="size">Size</label>
            <input type="number" id="size" 
              on:change={onSizeChange} 
              value={$search.size} />
          </div>
          <div class="field">
            <label for="from">From</label>
            <input type="number" id="from" 
              on:change={onFromChange} 
              value={$search.from} />
          </div>
          <div class="field">
            <label for="sort">Sort</label>
            <input type="text" id="sort" 
              on:change={e => onStateFieldChange({sort: e.target.value.trim()})} 
              value={$search.sort} />
          </div>

          <div class="field">
            <label>_Source</label>
            <div class="ui checkbox">
              <input id="source" type="checkbox" 
                on:change={e => onStateFieldChange({useSource: e.target.checked})} 
                checked={$search.useSource} />
              <label for="source">Enable</label>
            </div>
          </div>

          {#if $search.useSource}
            <div class="field">
              <label for="source-value">&nbsp;</label>
              <input type="text" id="source-value" 
                on:change={e => onStateFieldChange({_source: e.target.value})}
                value={$search._source} />
            </div>
          {/if}
        {/if} 

        <div class="field">
          <label>Doc Type</label>
          <div class="ui checkbox">
            <input id="use-doc-type" type="checkbox" 
              on:change={e => onStateFieldChange({useDocType: e.target.checked})} 
              checked={$search.useDocType} />
            <label for="use-doc-type">Enable</label>
          </div>
        </div>

        {#if $search.useDocType}
          <div class="field">
            <label for="type-value">&nbsp;</label>
            <input type="text" id="type-value" 
              on:change={onDocTypeChange}
              value={$search.docType} />
          </div>
        {/if}
      </div>
      <div class="field" class:hidden={$search.type !== 'body'}>
        <div id="request-body-editor" bind:this={requestBodyEditor}></div>
      </div>
      {#if $search.type === 'body'}
        <button class="ui green button" 
          class:loading={$search.loading} 
          disabled={$search.loading} 
          on:click={onSearchRun}>
          Run
        </button>
      {/if}
      <div class="field" class:hidden={$search.type !== 'uri'}>
        <label for="uri">URI Query</label>
        <div class="ui fluid action input">
          <input id="uri" type="text" on:change={e => onStateFieldChange({uriQuery:e.target.value})} value={$search.uriQuery} />
          <button class="ui green button" 
            class:loading={$search.loading} 
            disabled={$search.loading} 
            on:click={onSearchRun}>
            Run
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="ui segment">
    <div class="ui circular labels stats">
      Documents found: &nbsp;<span class="ui label">{$search.stats.total_results}</span>
      Time: &nbsp;<span class="ui label">{$search.stats.time/1000}s</span>
      Shards: &nbsp;<span class="ui blue label" title="Total">{$search.stats.total_shards}</span>
      <span class="ui green label" title="Successful">{$search.stats.successful_shards}</span>
      <span class="ui yellow label" title="Skipped">{$search.stats.skipped_shards}</span>
      <span class="ui red label" title="Failed">{$search.stats.failed_shards}</span>
    </div>
    <div id="results-editor" bind:this={resultsEditor}></div>
  </div>
</div>