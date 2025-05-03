<script>
	let { children, name, active } = $props()
</script>

<div class="ui tab segmen" class:active={active === name}>
	{@render children?.()}
</div>
