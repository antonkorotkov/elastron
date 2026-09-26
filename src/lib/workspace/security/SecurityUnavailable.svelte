<script>
	import { useStoreon } from '@storeon/svelte'
	import { isThemeToggleChecked } from '$lib/utils/helpers'
	import { CAUSE } from '$lib/security/causes.js'

	const { app } = useStoreon('app')
	let inverted = $derived(isThemeToggleChecked($app.theme))

	/**
	 * Says why a surface is not available. The cluster's own wording is offered
	 * as detail behind a toggle, never as the message: a cluster with security
	 * disabled answers a user listing with "Incorrect HTTP method", which tells
	 * the user nothing true.
	 */
	let { cause = CAUSE.UNKNOWN, message = '', reason = '', entity = 'this' } = $props()

	const HEADINGS = {
		[CAUSE.SECURITY_DISABLED]: 'Security Is Not Enabled On This Cluster',
		[CAUSE.LICENSE]: 'Not Available On This Licence',
		[CAUSE.PRIVILEGE]: 'Not Available With This Account',
		[CAUSE.RESERVED]: 'Reserved By Elasticsearch',
		[CAUSE.CREDENTIALS]: 'Credentials Rejected',
		[CAUSE.UNREACHABLE]: 'Cluster Unreachable',
		[CAUSE.UNKNOWN]: 'Not Available',
	}

	const detailFor = (c, what) =>
		({
			[CAUSE.SECURITY_DISABLED]:
				'Users, roles, and API keys can only be managed on a cluster started with security enabled.',
			[CAUSE.LICENSE]:
				"The cluster's licence does not cover this feature. Document- and field-level security in roles need a Platinum or Enterprise licence.",
			[CAUSE.PRIVILEGE]: `Your account does not hold the privilege needed to see or change ${what} on this cluster. Managing users and roles needs the manage_security cluster privilege; reading them needs read_security.`,
			[CAUSE.CREDENTIALS]: "The cluster rejected this connection's credentials.",
			[CAUSE.UNREACHABLE]:
				'The cluster did not answer. Check the connection, and the SSH tunnel if this connection uses one.',
		})[c]

	let heading = $derived(HEADINGS[cause] || HEADINGS[CAUSE.UNKNOWN])
	let detail = $derived(detailFor(cause, entity) || message)
	let showRaw = $state(false)
</script>

<div class="security-unavailable" data-cause={cause}>
	<i class="massive lock grey icon"></i>
	<div class="ui header" class:inverted>{heading}</div>
	<p>{detail}</p>
	{#if reason}
		<button class="ui small basic compact button" class:inverted onclick={() => (showRaw = !showRaw)}>
			{showRaw ? 'Hide' : 'Show'} what the cluster reported
		</button>
		{#if showRaw}
			<pre>{reason}</pre>
		{/if}
	{/if}
</div>

<style>
	.security-unavailable {
		text-align: center;
		padding: 2.5rem 1rem;
		max-width: 38rem;
		margin: 0 auto;
	}
	.security-unavailable .icon {
		margin-bottom: 1rem;
	}
	.security-unavailable p {
		margin-bottom: 1rem;
	}
	pre {
		margin-top: 0.75rem;
		text-align: left;
		white-space: pre-wrap;
		word-break: break-word;
		font-size: 0.85em;
	}
</style>
