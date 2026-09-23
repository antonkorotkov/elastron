import { describe, it, expect } from 'vitest';
import {
	EXCEPT_WITHOUT_GRANT,
	QUERY_FORM,
	readFieldSecurity,
	readQuery,
	refuseFieldSecurity,
	writeFieldSecurity,
	writeQuery,
} from './blockQuery';

// Elasticsearch returns every query shape as a string, verified against a
// trial-licence cluster: an object, a string and a template all come back
// stringified. These are the exact values it returned.
const STORED_QUERY = '{"term":{"dept":"eng"}}';
const STORED_TEMPLATE = '{"template":{"source":"{\\"term\\":{\\"owner\\":\\"{{_user.username}}\\"}}"}}';

const roundTrip = block => writeQuery(readQuery(block));

describe('reading a block query', () => {
	it('shows a stored query as structured JSON, not a quoted string', () => {
		expect(readQuery({ query: STORED_QUERY })).toMatchObject({
			form: QUERY_FORM.QUERY,
			source: { term: { dept: 'eng' } },
		});
	});

	it('shows a template own source, not the string it is stored in', () => {
		expect(readQuery({ query: STORED_TEMPLATE })).toMatchObject({
			form: QUERY_FORM.TEMPLATE,
			source: { term: { owner: '{{_user.username}}' } },
		});
	});

	it('reports a block with no query', () => {
		expect(readQuery({}).form).toBe(QUERY_FORM.NONE);
		expect(readQuery({ query: '' }).form).toBe(QUERY_FORM.NONE);
	});

	it('accepts a query the cluster handed back as an object', () => {
		expect(readQuery({ query: { term: { a: 'b' } } })).toMatchObject({
			form: QUERY_FORM.QUERY,
			source: { term: { a: 'b' } },
		});
	});

	it('marks a template it cannot show, such as a stored script', () => {
		const stored = '{"template":{"id":"my_stored_template"}}';
		expect(readQuery({ query: stored })).toMatchObject({
			form: QUERY_FORM.TEMPLATE,
			unmodelled: true,
		});
	});
});

describe('writing a block query', () => {
	it('writes an untouched query back exactly as the cluster reported it', () => {
		// Not re-serialised: key order and spacing survive, so opening a role
		// and saving it changes nothing.
		expect(roundTrip({ query: STORED_QUERY })).toBe(STORED_QUERY);
	});

	it('writes an untouched template back exactly as it came', () => {
		expect(roundTrip({ query: STORED_TEMPLATE })).toBe(STORED_TEMPLATE);
	});

	it('sends an edited query as an object, which the cluster accepts', () => {
		const held = readQuery({ query: STORED_QUERY });
		expect(writeQuery({ ...held, source: { term: { dept: 'sales' } } })).toEqual({
			term: { dept: 'sales' },
		});
	});

	it('sends an edited template as a template', () => {
		const held = readQuery({ query: STORED_TEMPLATE });
		const written = writeQuery({ ...held, source: { term: { owner: '{{_user.username}}', extra: 1 } } });

		expect(written).toEqual({
			template: { source: '{"term":{"owner":"{{_user.username}}","extra":1}}' },
		});
	});

	it('sends nothing at all when there is no query', () => {
		expect(roundTrip({})).toBeUndefined();
	});

	it('omits the field when a query is cleared rather than sending it empty', () => {
		expect(writeQuery({ form: QUERY_FORM.NONE, source: { term: {} } })).toBeUndefined();
	});

	it('writes back a query it could not parse exactly as it came', () => {
		const broken = '{not json}';
		expect(roundTrip({ query: broken })).toBe(broken);
	});

	it('writes back a template it could not show exactly as it came', () => {
		const stored = '{"template":{"id":"my_stored_template"}}';
		expect(roundTrip({ query: stored })).toBe(stored);
	});

	it('carries an edit through', () => {
		const held = readQuery({ query: STORED_QUERY });
		expect(writeQuery({ ...held, source: { term: { dept: 'sales' } } })).toEqual({
			term: { dept: 'sales' },
		});
	});
});

describe('field restrictions', () => {
	it('round-trips what the cluster stores', () => {
		const block = { field_security: { grant: ['a', 'b.*'], except: ['b.secret'] } };
		expect(writeFieldSecurity(readFieldSecurity(block))).toEqual(block.field_security);
	});

	it('sends nothing when nothing is restricted', () => {
		expect(writeFieldSecurity({ grant: [], except: [] })).toBeUndefined();
		expect(writeFieldSecurity(readFieldSecurity({}))).toBeUndefined();
	});

	it('omits an empty except rather than sending it', () => {
		expect(writeFieldSecurity({ grant: ['a'], except: [] })).toEqual({ grant: ['a'] });
	});

	it('refuses except without grant, which the cluster rejects', () => {
		expect(refuseFieldSecurity({ grant: [], except: ['x'] })).toBe(EXCEPT_WITHOUT_GRANT);
		expect(refuseFieldSecurity({ grant: ['a'], except: ['x'] })).toBeNull();
		expect(refuseFieldSecurity({ grant: [], except: [] })).toBeNull();
	});

	it('does not alias the block it read from', () => {
		const block = { field_security: { grant: ['a'], except: [] } };
		const held = readFieldSecurity(block);
		held.grant.push('b');
		expect(block.field_security.grant).toEqual(['a']);
	});
});
