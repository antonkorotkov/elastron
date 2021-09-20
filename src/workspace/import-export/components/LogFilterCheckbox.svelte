<script>
  export let label, onChange, checked, disabled

  const id = `log-${label.toLowerCase()}`
</script>

<div class="ui checkbox">
  <input {id} type="checkbox" on:change={onChange} {checked} {disabled} />
  <label for={id}>{label}</label>
</div>
