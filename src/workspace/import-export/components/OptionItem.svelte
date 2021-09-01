<script>
  import { classToggle } from '../../../utils/helpers'

  export let name
  export let value
  export let onDelete = () => {}
  export let onChangeName = () => {}
  export let onChangeValue = () => {}
</script>

<div class="fields">
  <div class="seven wide field">
    <input
      type="text"
      placeholder="Option Name"
      value={name}
      on:change={onChangeName}
    />
  </div>
  <div class="eight wide field">
    <input
      type="text"
      placeholder="Option Value"
      {value}
      on:change={onChangeValue}
    />
  </div>
  <div class="one wide field">
    <i
      class="minus circle icon"
      on:mouseover={e => classToggle(e, 'green')}
      on:focus={e => classToggle(e, 'green')}
      on:mouseout={e => classToggle(e, 'green')}
      on:blur={e => classToggle(e, 'green')}
      on:click={onDelete}
    />
  </div>
</div>
