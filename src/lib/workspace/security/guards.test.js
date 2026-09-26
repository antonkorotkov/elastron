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

	it('assumes an unknown role manages security, rather than waving the edit through', () => {
		// Concluding "not managing" makes the guard decide the account never
		// held a managing role, and it then allows the very change it exists to
		// stop. Reading the catalogue can fail, so this case is reachable.
		expect(roleManagesSecurity('mystery', undefined)).toBe(true);
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

describe('refuseUserRoleChange when the role catalogue could not be read', () => {
	it('still refuses an account stripping its own roles', () => {
		// A failed catalogue read marks the list loaded, so an empty catalogue
		// can persist for a whole session.
		expect(refuseUserRoleChange('admin', [], me('admin', ['custom_admin']), {})).toBe(
			SELF_DEMOTE_REFUSAL
		);
	});

	it('allows the change when a role is kept, since it may be the managing one', () => {
		expect(refuseUserRoleChange('admin', ['custom_admin'], me('admin', ['custom_admin']), {})).toBeNull();
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
