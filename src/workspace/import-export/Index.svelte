<script>
  import { useStoreon } from '@storeon/svelte'
  import { classToggle, isThemeToggleChecked } from '../../utils/helpers'
  import ipcRenderer from '../../api/ipc-renderer'

  const { app } = useStoreon('app')

  let active = false

  const onRunClick = e => {
    ipcRenderer.run('import-export-run').then(result => console.log(result))
  }

  const onSourceFileSelect = e => {
    ipcRenderer
      .run('import-export-select-dir')
      .then(result => console.log(result))
  }

  $: inverted = isThemeToggleChecked($app.theme)
</script>

<div class="ui grid">
  <div class="six wide column">
    <div class="ui segment" class:inverted>
      <div class="ui form" class:inverted>
        <h4 class="ui dividing header" class:inverted>Input</h4>
        <div class="fields">
          <div class="four wide field">
            <label for="input-select">Type</label>
            <select id="input-select">
              <option value="file">File</option>
              <option value="index">Index</option>
            </select>
          </div>
          <div class="twelve wide field">
            <label for="input">Source</label>
            <input id="input" type="text" on:click={onSourceFileSelect} />
          </div>
        </div>
        <h4 class="ui dividing header" class:inverted>Output</h4>
        <div class="fields">
          <div class="four wide field">
            <label for="output-select">Type</label>
            <select id="output-select">
              <option value="file">File</option>
              <option value="index">Index</option>
            </select>
          </div>
          <div class="twelve wide field">
            <label for="output">Source</label>
            <input id="output" type="text" />
          </div>
        </div>
        <div class="ui accordion field" class:inverted class:active>
          <div class="title" class:active on:click={() => (active = !active)}>
            <i class="icon dropdown" />
            Advanced Options
          </div>
          <div class="content" class:active>
            <div class="options">
              <div class="fields">
                <div class="seven wide field">
                  <input type="text" placeholder="Option Name" />
                </div>
                <div class="seven wide field">
                  <input type="text" placeholder="Option Value" />
                </div>
                <div class="two wide field">
                  <i
                    class="minus circle icon"
                    on:mouseover={e => classToggle(e, 'green')}
                    on:focus={e => classToggle(e, 'green')}
                    on:mouseout={e => classToggle(e, 'green')}
                    on:blur={e => classToggle(e, 'green')}
                  />
                </div>
              </div>
              <i
                class="plus circle icon"
                on:mouseover={e => classToggle(e, 'green')}
                on:focus={e => classToggle(e, 'green')}
                on:mouseout={e => classToggle(e, 'green')}
                on:blur={e => classToggle(e, 'green')}
              />
            </div>
          </div>
        </div>
        <button class="green ui button" class:inverted on:click={onRunClick}
          >Run</button
        >
      </div>
    </div>
  </div>
  <div class="ten wide column">
    <div class="ui segment" class:inverted>Test</div>
  </div>
</div>
