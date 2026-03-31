import { redirect } from '@sveltejs/kit';

export function load({ url }) {
	redirect(302, `/dashboard/indices${url.search}`);
}
