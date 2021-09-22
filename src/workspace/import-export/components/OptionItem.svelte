<script>
  import IconButton from '../../../components/buttons/IconButton.svelte'

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
  <div class="one wide field controls">
    <IconButton className="minus circle" onClick={onDelete} />
  </div>
</div>

<style>
  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
