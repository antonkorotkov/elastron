import { describe, it, expect, vi } from 'vitest';
import { errors as errors8 } from 'elasticsearch8';
import { errors as errors9 } from 'elasticsearch9';
import { performRequest } from './request';

const clientAnswering = impl => ({ transport: { request: vi.fn(impl) } });

const meta = (statusCode, body, contentType) => ({
	statusCode,
	body,
	headers: contentType ? { 'content-type': contentType } : {},
	warnings: [],
	meta: {},
});

describe('performRequest', () => {
	it('returns the status, reason, content type and parsed body of a JSON response', async () => {
		const client = clientAnswering(async () => meta(200, { status: 'green' }, 'application/json'));

		await expect(performRequest(client, { method: 'GET', path: '/_cluster/health' })).resolves.toEqual({
			statusCode: 200,
			statusText: 'OK',
			contentType: 'application/json',
			body: { status: 'green' },
		});
		expect(client.transport.request).toHaveBeenCalledWith(
			{ method: 'GET', path: '/_cluster/health' },
			{ meta: true, maxRetries: 0 }
		);
	});

	it('returns a text response as text', async () => {
		const table = 'health status index\ngreen  open   logs\n';
		const client = clientAnswering(async () => meta(200, table, 'text/plain; charset=UTF-8'));

		await expect(performRequest(client, { path: '/_cat/indices' })).resolves.toEqual({
			statusCode: 200,
			statusText: 'OK',
			contentType: 'text/plain; charset=UTF-8',
			body: table,
		});
	});

	it('returns HEAD results with their status', async () => {
		const found = clientAnswering(async () => meta(200, true));
		const missing = clientAnswering(async () => meta(404, false));

		await expect(performRequest(found, { method: 'HEAD', path: '/logs' })).resolves.toMatchObject({
			statusCode: 200,
			body: true,
		});
		await expect(performRequest(missing, { method: 'HEAD', path: '/nope' })).resolves.toMatchObject({
			statusCode: 404,
			statusText: 'Not Found',
			body: false,
		});
	});

	it('passes the body and never request headers', async () => {
		const client = clientAnswering(async () => meta(200, {}));

		await performRequest(client, {
			method: 'POST',
			path: '/x/_search',
			elasticBody: { size: 0 },
			headers: { 'x-opaque-id': 'nope' },
		});

		expect(client.transport.request).toHaveBeenCalledWith(
			{ method: 'POST', path: '/x/_search', body: { size: 0 } },
			{ meta: true, maxRetries: 0 }
		);
	});

	describe.each([
		['v8', errors8],
		['v9', errors9],
	])('with the %s client errors', (_label, errors) => {
		it('returns an error response the cluster sent, with its full body', async () => {
			const body = { error: { root_cause: [{ reason: 'no such index [nope]' }], type: 'index_not_found_exception' }, status: 404 };
			const client = clientAnswering(async () => {
				throw new errors.ResponseError(meta(404, body, 'application/json'));
			});

			await expect(performRequest(client, { path: '/nope/_search' })).resolves.toEqual({
				statusCode: 404,
				statusText: 'Not Found',
				contentType: 'application/json',
				body,
			});
		});

		it('rethrows a failure that has no cluster response', async () => {
			const client = clientAnswering(async () => {
				throw new errors.ConnectionError('connect ECONNREFUSED', {});
			});

			await expect(performRequest(client, { path: '/' })).rejects.toMatchObject({ name: 'ConnectionError' });
		});
	});
});
