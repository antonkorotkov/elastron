import { json } from '@sveltejs/kit';
import { tunnelManager } from '$lib/server/tunnel';

export async function POST({ request }) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	const { windowId } = body;

	if (!windowId) {
		return json({ error: 'windowId is required' }, { status: 400 });
	}

	try {
		await tunnelManager.close(windowId);
		return json({ data: { closed: true } });
	} catch (err) {
		console.error('SSH Tunnel Close Error:', err);
		return json({ error: err.message }, { status: 500 });
	}
}
