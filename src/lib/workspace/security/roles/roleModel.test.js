import { describe, it, expect } from 'vitest';
import {
	applyEdit,
	parseList,
	toWritableRole,
	unmodelledFields,
	usesDocumentOrFieldSecurity,
} from './roleModel';

// Shaped like a role the Enterprise cluster actually returns.
const realRole = () => ({
	name: 'acc_role_522cd3ae',
	reserved: false,
	hasDocumentQuery: true,
	hasFieldSecurity: false,
	cluster: [],
	indices: [
		{
			names: ['assets', 'assets_v*'],
			privileges: ['read', 'view_index_metadata'],
			query: '{"bool":{"should":[{"terms":{"holder.id":["522cd3ae"]}}]}}',
			allow_restricted_indices: false,
		},
	],
	applications: [{ application: 'kibana-.kibana', privileges: ['all'], resources: ['*'] }],
	run_as: [],
	metadata: { team: 'assets', _reserved: false },
	transient_metadata: { enabled: true },
});

describe('toWritableRole', () => {
	it('keeps every field the structured form does not model', () => {
		const writable = toWritableRole(realRole());

		expect(writable.applications).toEqual(realRole().applications);
		expect(writable.indices[0].query).toBe(realRole().indices[0].query);
	});

	it('drops what the cluster refuses on write', () => {
		const writable = toWritableRole(realRole());

		expect(writable).not.toHaveProperty('transient_metadata');
		expect(writable).not.toHaveProperty('name');
		expect(writable).not.toHaveProperty('reserved');
		expect(writable).not.toHaveProperty('hasDocumentQuery');
		expect(writable.metadata).not.toHaveProperty('_reserved');
	});

	it('removes metadata entirely when only reserved keys were in it', () => {
		expect(toWritableRole({ metadata: { _reserved: true } })).not.toHaveProperty('metadata');
	});

	it('round-trips an application privilege and a document query untouched', () => {
		const original = realRole();
		const edited = applyEdit(toWritableRole(original), { cluster: ['monitor'] });

		expect(JSON.stringify(edited.applications)).toBe(JSON.stringify(original.applications));
		expect(JSON.stringify(edited.indices)).toBe(JSON.stringify(original.indices));
		expect(edited.cluster).toEqual(['monitor']);
	});
});

describe('unmodelledFields', () => {
	it('names the fields the structured form cannot show', () => {
		expect(unmodelledFields(toWritableRole(realRole()))).toEqual(['applications']);
	});

	it('ignores fields that are present but empty', () => {
		expect(unmodelledFields({ cluster: [], applications: [], global: {} })).toEqual([]);
	});
});

describe('usesDocumentOrFieldSecurity', () => {
	it('detects a document query', () => {
		expect(usesDocumentOrFieldSecurity(realRole())).toBe(true);
	});

	it('detects field security', () => {
		expect(usesDocumentOrFieldSecurity({ indices: [{ field_security: { grant: ['a'] } }] })).toBe(true);
	});

	it('is false for a plain role', () => {
		expect(usesDocumentOrFieldSecurity({ indices: [{ names: ['a'], privileges: ['read'] }] })).toBe(false);
	});
});

describe('parseList', () => {
	it('splits on commas and newlines, trimming blanks', () => {
		expect(parseList(' logs-* , metrics-*\n\n traces-* ')).toEqual(['logs-*', 'metrics-*', 'traces-*']);
	});

	it('returns an empty list for nothing', () => {
		expect(parseList('')).toEqual([]);
		expect(parseList(null)).toEqual([]);
	});
});
