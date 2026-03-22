import { describe, it, expect } from 'vitest'
import { hasPermission, getBuiltInRolePermissions, BUILT_IN_ROLES } from '@/lib/permissions'

describe('hasPermission', () => {
  it('exact match: orders.create matches orders.create', () => {
    expect(hasPermission(['orders.create'], 'orders.create')).toBe(true)
  })

  it('global wildcard: * matches anything', () => {
    expect(hasPermission(['*'], 'orders.create')).toBe(true)
    expect(hasPermission(['*'], 'billing.manage')).toBe(true)
  })

  it('category wildcard: orders.* matches orders.create', () => {
    expect(hasPermission(['orders.*'], 'orders.create')).toBe(true)
    expect(hasPermission(['orders.*'], 'orders.delete')).toBe(true)
  })

  it('category wildcard does not match different category', () => {
    expect(hasPermission(['orders.*'], 'trips.create')).toBe(false)
  })

  it('no match: orders.create does not match trips.create', () => {
    expect(hasPermission(['orders.create'], 'trips.create')).toBe(false)
  })

  it('empty permissions returns false', () => {
    expect(hasPermission([], 'orders.create')).toBe(false)
  })
})

describe('getBuiltInRolePermissions', () => {
  it('admin returns wildcard permissions', () => {
    expect(getBuiltInRolePermissions('admin')).toEqual(['*'])
  })

  it('owner returns wildcard permissions (legacy)', () => {
    expect(getBuiltInRolePermissions('owner')).toEqual(['*'])
  })

  it('dispatcher returns expected permission array', () => {
    const perms = getBuiltInRolePermissions('dispatcher')
    expect(perms).toEqual(BUILT_IN_ROLES.dispatcher)
    expect(perms).toContain('orders.*')
    expect(perms).toContain('trips.*')
    expect(perms).not.toContain('billing.*')
  })

  it('billing returns limited permissions', () => {
    const perms = getBuiltInRolePermissions('billing')
    expect(perms).toContain('billing.*')
    expect(perms).toContain('orders.view')
    expect(perms).not.toContain('orders.create')
  })

  it('custom role prefix returns null (caller fetches from DB)', () => {
    expect(getBuiltInRolePermissions('custom:abc-123')).toBeNull()
  })

  it('unknown role returns empty array', () => {
    expect(getBuiltInRolePermissions('nonexistent')).toEqual([])
  })
})
