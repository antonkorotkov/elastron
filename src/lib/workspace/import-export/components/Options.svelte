<script>
	import { useStoreon } from '@storeon/svelte'
	import IconButton from '../../../components/buttons/IconButton.svelte'
	import OptionItem from './OptionItem.svelte'

	const { dispatch, importExport } = useStoreon('importExport')

	const onOptionChange = function (e) {
		const { index, field } = this,
			value = e.target.value
		dispatch('ie/update/option', {
			index,
			field,
			value,
		})
	}
</script>

<div class="options">
	{#each $importExport.options as option, index}
		<OptionItem
			name={option.name}
			value={option.value}
			onDelete={() => dispatch('ie/delete/option', index)}
			onChangeName={onOptionChange.bind({ index, field: 'name' })}
			onChangeValue={onOptionChange.bind({ index, field: 'value' })}
		/>
	{/each}

	<IconButton
		className="plus circle"
		onClick={() => dispatch('ie/add/option')}
	/>
</div>
