import { describe, it, expect } from 'vitest';
import {
	anyRoleManagesSecurity,
	isSelf,
	refuseUserDelete,
	refuseUserRoleChange,
	roleManagesSecurity,
	SELF_DELETE_REFUSAL,
	SELF_DEMOTE_REFUSAL,
} from './guards';

const catalogue = {
	superuser: { cluster: ['all'], metadata: { _reserved: true } },
	security_admin: { cluster: ['manage_security', 'monitor'] },
	viewer: { cluster: [] },
	monitoring: { cluster: ['monitor'] },
};

const me = (username, roles) => ({ username, roles });

describe('roleManagesSecurity', () => {
	it.each([
		['superuser', true],
		['security_admin', true],
		['viewer', false],
		['monitoring', false],
	])('%s -> %s', (name, expected) => {
		expect(roleManagesSecurity(name, catalogue[name])).toBe(expected);
	});

	it('treats an unknown role as not managing, which errs toward refusing', () => {
		expect(roleManagesSecurity('mystery', undefined)).toBe(false);
	});

	it('recognises superuser even when the catalogue has not loaded', () => {
		expect(anyRoleManagesSecurity(['superuser'], {})).toBe(true);
	});
});

describe('refuseUserDelete', () => {
	it('refuses deleting the account the connection signs in as', () => {
		expect(refuseUserDelete('elastic', me('elastic', ['superuser']))).toBe(SELF_DELETE_REFUSAL);
	});

	it('allows deleting anyone else', () => {
		expect(refuseUserDelete('alice', me('elastic', ['superuser']))).toBeNull();
	});

	it('allows a delete when the identity is unknown, rather than blocking everything', () => {
		expect(refuseUserDelete('alice', { username: null })).toBeNull();
	});
});

describe('refuseUserRoleChange', () => {
	it('refuses removing your own last managing role', () => {
		expect(refuseUserRoleChange('admin', ['viewer'], me('admin', ['security_admin']), catalogue)).toBe(
			SELF_DEMOTE_REFUSAL
		);
	});

	it('refuses an edit that clears your roles entirely', () => {
		expect(refuseUserRoleChange('admin', [], me('admin', ['superuser']), catalogue)).toBe(
			SELF_DEMOTE_REFUSAL
		);
	});

	it('allows the edit when a managing role remains', () => {
		expect(
			refuseUserRoleChange('admin', ['viewer', 'superuser'], me('admin', ['superuser']), catalogue)
		).toBeNull();
	});

	it('allows the same change on a different account', () => {
		expect(refuseUserRoleChange('alice', [], me('admin', ['superuser']), catalogue)).toBeNull();
	});

	it('does not interfere when the account never managed security', () => {
		expect(refuseUserRoleChange('reader', [], me('reader', ['viewer']), catalogue)).toBeNull();
	});
});

describe('isSelf', () => {
	it('is false when either side is unknown', () => {
		expect(isSelf('alice', { username: null })).toBe(false);
		expect(isSelf(null, { username: 'alice' })).toBe(false);
	});
});
