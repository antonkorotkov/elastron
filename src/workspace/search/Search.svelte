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
      if (editor) {
        const json = editor.get()
        dispatch('search/change/request-body', json)
      }
    } catch (error) {}
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
        mode: 'tree'
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
    <div id="results-editor" bind:this={resultsEditor}></div>
  </div>
</div>