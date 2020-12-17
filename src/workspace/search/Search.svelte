<script>
  import isEqual from 'lodash/isEqual'
  import JSONEditor from 'jsoneditor'
  import { useStoreon } from '@storeon/svelte'
  import { onMount, onDestroy, afterUpdate } from 'svelte'
  import get from 'lodash/get'
  import isEmpty from 'lodash/isEmpty'
  import isNumber from 'lodash/isNumber'
  import Select from 'svelte-select'

  import Pagination from '../../components/pagination/Pagination.svelte'

  import 'jsoneditor/dist/jsoneditor.min.css'

  const { dispatch, search, indices } = useStoreon('search', 'indices')

  let requestBodyEditor, resultsEditor
  let qEditor, rEditor

  $: _indices = $indices.data.map(
    item =>
      item[
        $indices.columns.reduce(
          (i, item, index) => (item === 'index' ? index : i),
          0
        )
      ]
  )

  $: uriPaginationCurrentPage = () => Math.round($search.from / $search.size)

  $: bodyPaginationCurrentPage = () => {
    const body = $search.requestBody
    const from = get(body, 'from', 0)
    const size = get(body, 'size', 10)

    return Math.round(from / size)
  }

  $: bodyPaginationOffset = () => get($search.requestBody, 'from', 0)

  $: bodyPaginationItemsPerPage = () => get($search.requestBody, 'size', 10)

  const onEditorChange = () => {
    try {
      if (qEditor) {
        const requestBody = qEditor.get()
        dispatch('search/update', { requestBody })
      }
    } catch (err) {}
  }

  const onDocTypeChange = e => {
    const docType = e.target.value.trim() || '_doc'
    dispatch('search/update', { docType })
    e.target.value = docType
  }

  const onSearchRun = e => {
    if ($search.view === 'edit') {
      dispatch('search/update', {
        view: 'hits',
      })
    }
    dispatch('search/run')
  }

  const onStateFieldChange = data => dispatch('search/update', data)

  const onSizeChange = e => {
    const size =
      !e.target.value.trim() || Number(e.target.value.trim()) < 0
        ? 10
        : Number(e.target.value.trim())
    dispatch('search/update', { size })
    e.target.value = size
  }

  const onFromChange = e => {
    const from =
      !e.target.value.trim() || Number(e.target.value.trim()) < 0
        ? 0
        : Number(e.target.value.trim())
    dispatch('search/update', { from })
    e.target.value = from
  }

  const onClickRemove = index => {
    if (
      confirm('Are you sure you want to delete this document from the index?')
    )
      dispatch('search/documents/delete', index)
  }

  let canEditDoc = false
  const onClickEditDocument = index => {
    dispatch('search/update', { editDoc: $search.results[index] })
    canEditDoc = false
    switchView('edit')
  }

  onMount(() => {
    if (requestBodyEditor) {
      qEditor = new JSONEditor(
        requestBodyEditor,
        {
          mode: 'code',
          onChange: onEditorChange,
        },
        $search.requestBody
      )
      qEditor.aceEditor.setOptions({ maxLines: 32 })
    }

    if (resultsEditor) {
      rEditor = new JSONEditor(
        resultsEditor,
        {
          mode: 'tree',
          onChange: () => {
            try {
              rEditor.get()
              canEditDoc = true
            } catch (e) {
              canEditDoc = false
            }
          },
          onEditable: function() {
            if (rEditor && rEditor.getMode() == 'code') return true
            return false
          },
          onEvent: (node, event) => {
            if (event.type === 'mouseover') {
              if (event.target.tagName.toLowerCase() === 'a') {
                event.target.target = '_blank'
              }
            }
          },
          onCreateMenu: (items, node) => {
            if (
              node.type === 'single' &&
              isNumber(node.path[0]) &&
              node.path.length === 1
            ) {
              return [
                {
                  text: 'Edit',
                  title: 'Edit the document and commit updates to the server',
                  className: 'jsoneditor-type-object',
                  click: () => onClickEditDocument(node.path[0]),
                },
                {
                  text: 'Delete',
                  title: 'Delete the document from the server',
                  className: 'jsoneditor-remove',
                  click: () => onClickRemove(node.path[0]),
                },
              ]
            }
            return []
          },
        },
        $search.results
      )
    }
  })

  let prevView = 'hits'
  afterUpdate(() => {
    try {
      if (rEditor) {
        let json = {}
        switch ($search.view) {
          case 'hits':
            json = $search.results
            rEditor.setMode('tree')
            break
          case 'aggs':
            json = !isEmpty($search.aggs) ? $search.aggs : $search.results
            rEditor.setMode('tree')
            break
          case 'raw':
            json = !isEmpty($search.response)
              ? $search.response
              : $search.results
            rEditor.setMode('tree')
            break
          case 'edit':
            json = !isEmpty($search.editDoc) ? $search.editDoc._source : {}
            rEditor.setMode('code')
            rEditor.aceEditor.setOptions({ maxLines: 100 })
            break
          default:
            break
        }

        if (!isEqual(rEditor.get(), json)) {
          if ($search.view != prevView) rEditor.set(json)
          else {
            if ($search.view !== 'edit') rEditor.update(json)
          }
        }

        prevView = $search.view
      }
    } catch (e) {}
  })

  onDestroy(() => {
    if (qEditor) {
      qEditor.destroy()
    }
    if (rEditor) {
      rEditor.destroy()
    }
  })

  const onUriPaginationChanged = ({ detail }) => {
    dispatch('search/update', { from: $search.size * detail })
    dispatch('search/run')
  }

  const onBodyPaginationChanged = ({ detail }) => {
    try {
      const requestBody = qEditor.get()
      const size = get(requestBody, 'size', 10)
      requestBody.from = size * detail
      qEditor.set(requestBody)
      dispatch('search/update', { requestBody })
      dispatch('search/run')
    } catch (error) {
      dispatch('notification/add', {
        type: 'error',
        message: error.message,
      })
    }
  }

  const onProfilingChanged = checked => {
    const requestBody = qEditor.get()
    if (checked) {
      requestBody.profile = true
    } else {
      delete requestBody.profile
    }
    qEditor.set(requestBody)
    dispatch('search/update', { requestBody })
    onStateFieldChange({ profiling: checked })
  }

  const onExplainChanged = checked => {
    const requestBody = qEditor.get()
    if (checked) {
      requestBody.explain = true
    } else {
      delete requestBody.explain
    }
    qEditor.set(requestBody)
    dispatch('search/update', { requestBody })
    onStateFieldChange({ explain: checked })
  }

  const switchView = view => {
    dispatch('search/update', { view })
  }

  const saveEditDoc = method => {
    if (method === 'update')
      return () => {
        try {
          if (
            confirm(
              'Only listed fields will be updated in the document. Continue?'
            )
          )
            dispatch('search/documents/update', rEditor.get())
        } catch ({ message }) {
          dispatch('notification/add', {
            type: 'error',
            message,
          })
        }
      }

    if (method === 'reindex')
      return () => {
        try {
          if (
            confirm(
              'The entire document will be reindexed using listed fields. Continue?'
            )
          )
            dispatch('search/documents/reindex', rEditor.get())
        } catch ({ message }) {
          dispatch('notification/add', {
            type: 'error',
            message,
          })
        }
      }
  }
</script>

<style>
  .hidden {
    display: none;
  }

  .search-options input[type='number'] {
    width: 6rem !important;
  }

  .stats {
    margin-bottom: 7px;
  }

  .edit-doc {
    margin-bottom: 12px;
  }

  .pagination {
    text-align: right;
  }

  .themed {
    min-width: 190px;
    --height: 38px;
  }
</style>

<div class="ui segments">
  <div class="ui segment">
    <div class="ui form">
      <div class="fields search-options">
        <div class="field">
          <label for="type">Search Type</label>
          <select
            id="type"
            class="ui dropdown"
            on:change={e => onStateFieldChange({ type: e.target.value })}
            value={$search.type}>
            <option value="uri">URI Search</option>
            <option value="body">Request Body</option>
          </select>
        </div>
        <div class="field themed">
          <label for="index">Index</label>
          <Select
            inputStyles="height:36px;"
            items={_indices}
            isCreatable={true}
            selectedValue={$search.index}
            on:select={e => onStateFieldChange({ index: e.detail.value })}
            on:clear={e => onStateFieldChange({ index: '_all' })} />
        </div>

        {#if $search.type === 'uri'}
          <div class="field">
            <label for="size">Size</label>
            <input
              type="number"
              id="size"
              on:change={onSizeChange}
              value={$search.size} />
          </div>
          <div class="field">
            <label for="from">From</label>
            <input
              type="number"
              id="from"
              on:change={onFromChange}
              value={$search.from} />
          </div>
          <div class="field">
            <label for="sort">Sort</label>
            <input
              type="text"
              id="sort"
              on:change={e => onStateFieldChange({
                  sort: e.target.value.trim(),
                })}
              value={$search.sort} />
          </div>

          <div class="field">
            <label for="source">_Source</label>
            <div class="ui checkbox">
              <input
                id="source"
                type="checkbox"
                on:change={e => onStateFieldChange({
                    useSource: e.target.checked,
                  })}
                checked={$search.useSource} />
              <label for="source">Enable</label>
            </div>
          </div>

          {#if $search.useSource}
            <div class="field">
              <label for="source-value">&nbsp;</label>
              <input
                type="text"
                id="source-value"
                on:change={e => onStateFieldChange({ _source: e.target.value })}
                value={$search._source} />
            </div>
          {/if}
        {/if}

        <div class="field">
          <label for="use-doc-type">Doc Type</label>
          <div class="ui checkbox">
            <input
              id="use-doc-type"
              type="checkbox"
              on:change={e => onStateFieldChange({
                  useDocType: e.target.checked,
                })}
              checked={$search.useDocType} />
            <label for="use-doc-type">Enable</label>
          </div>
        </div>

        {#if $search.useDocType}
          <div class="field">
            <label for="type-value">&nbsp;</label>
            <input
              type="text"
              id="type-value"
              on:change={onDocTypeChange}
              value={$search.docType} />
          </div>
        {/if}

        <div class="field">
          <label for="explain">Explain</label>
          <div class="ui checkbox">
            <input
              id="explain"
              type="checkbox"
              on:change={e => onExplainChanged(e.target.checked)}
              checked={$search.explain} />
            <label for="explain">Enable</label>
          </div>
        </div>

        {#if $search.type === 'body'}
          <div class="field">
            <label for="profiling">Profiling</label>
            <div class="ui checkbox">
              <input
                id="profiling"
                type="checkbox"
                on:change={e => onProfilingChanged(e.target.checked)}
                checked={$search.profiling} />
              <label for="profiling">Enable</label>
            </div>
          </div>
        {/if}
      </div>
      <div class="field" class:hidden={$search.type !== 'body'}>
        <div id="request-body-editor" bind:this={requestBodyEditor} />
      </div>
      {#if $search.type === 'body'}
        <button
          class="ui green button"
          class:loading={$search.loading}
          disabled={$search.loading}
          on:click={onSearchRun}>
          Run
        </button>
      {/if}
      <div class="field" class:hidden={$search.type !== 'uri'}>
        <label for="uri">URI Query</label>
        <div class="ui fluid action input">
          <input
            id="uri"
            type="text"
            on:change={e => onStateFieldChange({ uriQuery: e.target.value })}
            on:keyup={e => (e.keyCode == 13 ? onSearchRun() : null)}
            value={$search.uriQuery} />
          <button
            class="ui green button"
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
    {#if $search.view === 'edit' && $search.editDoc}
      <div class="ui grid">
        <div class="sixteen wide column">
          <div class="edit-doc">
            Editing: &nbsp;
            <span class="ui label">
              {$search.editDoc._type}:{$search.editDoc._id}
            </span>
            of index
            <span class="ui label">{$search.editDoc._index}</span>
            &nbsp|&nbsp;
            <span class="ui text">
              <button
                class="mini ui button green"
                disabled={!canEditDoc || $search.loading}
                on:click={saveEditDoc('update')}>
                Update
              </button>
              <button
                class="mini ui button blue"
                disabled={!canEditDoc || $search.loading}
                on:click={saveEditDoc('reindex')}>
                Reindex
              </button>
              <button
                class="mini ui button red"
                disabled={$search.loading}
                on:click={() => switchView('hits')}>
                Cancel
              </button>
            </span>
          </div>
        </div>
      </div>
    {:else}
      <div class="ui grid">
        <div class="twelve wide column">
          <div class="ui circular labels stats">
            Documents found: &nbsp;
            <span class="ui label">{$search.stats.total_results}</span>
            Time: &nbsp;
            <span class="ui label">{$search.stats.time / 1000}s</span>
            Shards: &nbsp;
            <span class="ui blue label" title="Total">
              {$search.stats.total_shards}
            </span>
            <span class="ui green label" title="Successful">
              {$search.stats.successful_shards}
            </span>
            <span class="ui yellow label" title="Skipped">
              {$search.stats.skipped_shards}
            </span>
            <span class="ui red label" title="Failed">
              {$search.stats.failed_shards}
            </span>
            View: &nbsp;
            <span class="ui text">
              <button
                class="mini ui button"
                class:active={$search.view == 'hits'}
                class:disabled={isEmpty($search.results)}
                on:click={() => switchView('hits')}>
                Hits
              </button>
              <button
                class="mini ui button"
                class:active={$search.view == 'aggs'}
                class:disabled={isEmpty($search.aggs)}
                on:click={() => switchView('aggs')}>
                Aggs
              </button>
              <button
                class="mini ui button"
                class:active={$search.view == 'raw'}
                class:disabled={isEmpty($search.response)}
                on:click={() => switchView('raw')}>
                Raw
              </button>
            </span>
          </div>
        </div>
        <div class="four wide column pagination">
          {#if $search.type === 'uri'}
            <Pagination
              className="mini"
              disable={$search.loading}
              current_page={uriPaginationCurrentPage()}
              offset={$search.from}
              items_per_page={$search.size}
              total_items={$search.stats.total_results}
              on:change={onUriPaginationChanged} />
          {/if}

          {#if $search.type === 'body'}
            <Pagination
              className="mini"
              disable={$search.loading}
              current_page={bodyPaginationCurrentPage()}
              offset={bodyPaginationOffset()}
              items_per_page={bodyPaginationItemsPerPage()}
              total_items={$search.stats.total_results}
              on:change={onBodyPaginationChanged} />
          {/if}
        </div>
      </div>
    {/if}
    <div id="results-editor" bind:this={resultsEditor} />
  </div>
</div>
