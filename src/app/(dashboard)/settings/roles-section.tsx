'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCustomRole, updateCustomRole, deleteCustomRole } from '@/app/actions/custom-roles'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Shield, ChevronDown, ChevronUp } from 'lucide-react'
import { PERMISSION_CATEGORIES, CATEGORY_LABELS, BUILT_IN_ROLES, BUILT_IN_ROLE_LABELS, type BuiltInRole } from '@/lib/permissions'

interface CustomRole {
  id: string
  name: string
  description: string | null
  permissions: string[]
  created_at: string
}

interface RolesSectionProps {
  customRoles: CustomRole[]
}

export function RolesSection({ customRoles: initialRoles }: RolesSectionProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null)
  const [expandedBuiltIn, setExpandedBuiltIn] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  function resetForm() {
    setShowForm(false)
    setEditingRole(null)
    setName('')
    setDescription('')
    setSelectedPermissions([])
  }

  function startEdit(role: CustomRole) {
    setEditingRole(role)
    setName(role.name)
    setDescription(role.description || '')
    setSelectedPermissions(role.permissions)
    setShowForm(true)
  }

  function togglePermission(perm: string) {
    setSelectedPermissions(prev =>
      prev.includes(perm)
        ? prev.filter(p => p !== perm)
        : [...prev, perm]
    )
  }

  function toggleCategory(category: string) {
    const categoryPerms: string[] = [...PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES]]
    const allSelected = categoryPerms.every(p => selectedPermissions.includes(p))
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !categoryPerms.includes(p)))
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...categoryPerms])])
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = { name, description, permissions: selectedPermissions }
      const result = editingRole
        ? await updateCustomRole(editingRole.id, payload)
        : await createCustomRole(payload)

      if ('error' in result && result.error) {
        const errorMsg = typeof result.error === 'string' ? result.error : 'Validation error'
        toast.error(errorMsg)
        return
      }
      toast.success(editingRole ? 'Role updated' : 'Role created')
      resetForm()
      router.refresh()
    } catch {
      toast.error('Failed to save role')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const result = await deleteCustomRole(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Role deleted')
      router.refresh()
    } catch {
      toast.error('Failed to delete role')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Roles & Permissions
            </CardTitle>
            <CardDescription>
              Manage built-in and custom roles for your team.
            </CardDescription>
          </div>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Custom Role
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Built-in Roles */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Built-in Roles</h4>
          <div className="space-y-2">
            {(Object.keys(BUILT_IN_ROLE_LABELS) as BuiltInRole[]).map(role => (
              <div key={role} className="rounded-lg border bg-card/50 p-3">
                <button
                  className="flex w-full items-center justify-between"
                  onClick={() => setExpandedBuiltIn(expandedBuiltIn === role ? null : role)}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{BUILT_IN_ROLE_LABELS[role]}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {role === 'admin'
                        ? 'Full access'
                        : `${BUILT_IN_ROLES[role].length} permission groups`}
                    </span>
                  </div>
                  {expandedBuiltIn === role ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {expandedBuiltIn === role && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {BUILT_IN_ROLES[role].map(perm => (
                      <Badge key={perm} variant="outline" className="text-xs">
                        {perm}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Custom Roles List */}
        {initialRoles.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Custom Roles</h4>
            <div className="space-y-2">
              {initialRoles.map(role => (
                <div key={role.id} className="rounded-lg border bg-card/50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{role.name}</span>
                      {role.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {role.permissions.slice(0, 5).map(p => (
                          <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                        ))}
                        {role.permissions.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{role.permissions.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEdit(role)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(role.id)}
                        disabled={deleting === role.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (
          <div className="rounded-lg border bg-card/50 p-4 space-y-4">
            <h4 className="font-medium">
              {editingRole ? 'Edit Role' : 'Create Custom Role'}
            </h4>

            <div className="space-y-2">
              <Input
                placeholder="Role name (e.g. Accountant)"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
              />
              <Input
                placeholder="Description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>

            <div>
              <h5 className="text-sm font-medium mb-2">Permissions</h5>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => {
                  const allSelected = perms.every(p => selectedPermissions.includes(p))
                  const someSelected = perms.some(p => selectedPermissions.includes(p))
                  return (
                    <div key={category} className="rounded border p-2.5">
                      <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                          onChange={() => toggleCategory(category)}
                          className="rounded"
                        />
                        <span className="text-sm font-medium">
                          {CATEGORY_LABELS[category] || category}
                        </span>
                      </label>
                      <div className="space-y-0.5 ml-5">
                        {perms.map(perm => {
                          const action = perm.split('.')[1]
                          return (
                            <label key={perm} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedPermissions.includes(perm)}
                                onChange={() => togglePermission(perm)}
                                className="rounded"
                              />
                              <span className="text-xs text-muted-foreground capitalize">
                                {action}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !name.trim() || selectedPermissions.length === 0}
              >
                {saving ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
