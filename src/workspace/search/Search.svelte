<script>
  import isEqual from 'lodash/isEqual'
  import JSONEditor from 'jsoneditor'
  import { useStoreon } from '@storeon/svelte'
  import { onMount, onDestroy, afterUpdate } from 'svelte'

  import 'jsoneditor/dist/jsoneditor.min.css'

  const { dispatch, search, indices } = useStoreon('search', 'indices')

  let requestBodyEditor, resultsEditor
  let type = $search.type
  let index = $search.index
  let useDocType = $search.useDocType
  let uriQuery = $search.uriQuery
  let qEditor, rEditor

  $:  docType = $search.docType
  $:  size = $search.size
  $:  from = $search.from
  $:  _indices = $indices.data.map(item => 
        item[$indices.columns.reduce((i, item, index) => 
          item === 'index' ? index : i, 0
        )]
      )

  const onEditorChange = () => {
    try {
      if (qEditor) {
        const json = qEditor.get()
        dispatch('search/change/request-body', json)
      }
    } catch (error) {
      console.log(error)
    }
  }

  const onDocTypeKeyup = e => {
    const value = e.target.value.trim()
    dispatch('search/change/docType', value ? value : '_doc')
  }

  const onSearchRun = e => {
    dispatch('search/run')
  }

  onMount(() => {
    if (requestBodyEditor) {
      qEditor = new JSONEditor(requestBodyEditor, {
        mode: 'code',
        onChange: onEditorChange
      }, $search.requestBody)
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
                  console.log(node)
                }
              },
              {
                text: 'Delete',
                title: 'Delete the document from the server',
                className: 'jsoneditor-remove',
                click: () => {
                  console.log(node)
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
      console.log('updated')
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
      <div class="inline fields search-options">
        <div class="field">
          <label for="index">Search Type</label>
          <select id="index" class="ui dropdown" on:change={e => dispatch('search/change/type', e.target.value)} bind:value={type}>
            <option value="uri">URI Search</option>
            <option value="body">Request Body</option>
          </select>
        </div>
        <div class="field">
          <label for="index">Index</label>
          <select id="index" class="ui dropdown" on:change={e => dispatch('search/change/index', e.target.value)} bind:value={index}>
            <option value="">All</option>
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
              on:change={e => {
                if (!e.target.value.trim()) e.target.value = size
                dispatch('search/change/size', e.target.value)
              }} 
              value={size} />
          </div>
          <div class="field">
            <label for="from">From</label>
            <input type="number" id="from" 
              on:change={e => {
                if (!e.target.value.trim()) e.target.value = from
                dispatch('search/change/from', e.target.value)
              }} 
              value={from} />
          </div>
        {/if} 

        <div class="field">
          <div class="ui checkbox">
            <input id="type" type="checkbox" on:change={e => dispatch('search/change/useDocType', e.target.checked)} bind:checked={useDocType} />
            <label for="type" class:checked={useDocType}>
              {#if !useDocType}
                Use document type
              {:else}
                &nbsp;
              {/if}
            </label>
          </div>
        </div>

        {#if useDocType}
          <div class="field">
            <label for="type-value">Document Type</label>
            <input type="text" id="type-value" 
              on:keyup={onDocTypeKeyup}
              on:change={onDocTypeKeyup}
              value={docType} />
          </div>
        {/if}
        <div class="field">
          <button class="ui green button" 
            class:loading={$search.loading} 
            disabled={$search.loading} 
            on:click={onSearchRun}>
            Run
          </button>
        </div>
      </div>
      <div class="field" class:hidden={$search.type !== 'body'}>
        <div id="request-body-editor" bind:this={requestBodyEditor}></div>
      </div>
      <div class="field" class:hidden={$search.type !== 'uri'}>
        <label for="uri">URI Query</label>
        <input id="uri" type="text" on:change={e => dispatch('search/change/uri-query', e.target.value)} bind:value={uriQuery} />
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