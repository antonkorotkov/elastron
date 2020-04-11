<script>
  import { setContext as baseSetContext } from 'svelte'
  import { fly, fade } from 'svelte/transition'

  export let key = 'modal-window'
  export let closeOnEsc = true
  export let closeOnOuterClick = true
  export let setContext = baseSetContext

  const defaultState = {
    closeOnEsc,
    closeOnOuterClick
  }

  let state = { ...defaultState }

  let Component = null
  let props = null

  let background

  const open = (
    NewComponent,
    newProps = {},
    options = {}
  ) => {
    Component = NewComponent
    props = newProps
    state = { ...defaultState, ...options }
  }

  const close = () => {
    Component = null
    props = null
  }

  const handleKeyup = ({ key }) => {
    if (state.closeOnEsc && Component && key === 'Escape') {
      event.preventDefault()
      close()
    }
  };

  const handleOuterClick = (event) => {
    if (
      state.closeOnOuterClick && (
        event.target === background
      )
    ) {
      event.preventDefault()
      close()
    }
  };

  setContext(key, { open, close })
</script>

<svelte:window on:keyup={handleKeyup}/>

{#if Component}
  <div transition:fade="{{duration: 300}}" on:click={handleOuterClick} bind:this={background} class="ui dimmer modals page hidden flex active">
    <div class="ui tiny modal hidden active" transition:fly="{{ y: -500, duration: 300 }}">
      <Component {...props} />
    </div>
  </div>
{/if}

<slot></slot>