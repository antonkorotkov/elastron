<script>
	let { name, label, active, onClick } = $props()
</script>

<a
	href="##"
	class="item"
	class:active={active === name}
	onclick={onClick.bind(null, name)}
>
	{label}
</a>
