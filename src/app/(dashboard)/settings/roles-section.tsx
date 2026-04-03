'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCustomRole, updateCustomRole, deleteCustomRole } from '@/app/actions/custom-roles'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  Shield,
  ChevronDown,
  ChevronUp,
  Lock,
  ShieldCheck,
  Truck,
  Receipt,
  Package,
  Route,
  UserCog,
  Fuel,
  Wrench,
  ClipboardCheck,
  AlertTriangle,
  CreditCard,
  FileText,
  CheckSquare,
  MessageSquare,
  FolderOpen,
  DollarSign,
  Briefcase,
  Users,
  Settings,
  Plug,
  MapPin,
} from 'lucide-react'
import {
  PERMISSION_CATEGORIES,
  CATEGORY_LABELS,
  BUILT_IN_ROLES,
  BUILT_IN_ROLE_LABELS,
  type BuiltInRole,
} from '@/lib/permissions'

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

// Icon map per category
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  orders: <Package className="h-3.5 w-3.5" />,
  trips: <Route className="h-3.5 w-3.5" />,
  drivers: <UserCog className="h-3.5 w-3.5" />,
  trucks: <Truck className="h-3.5 w-3.5" />,
  trailers: <Truck className="h-3.5 w-3.5" />,
  brokers: <Users className="h-3.5 w-3.5" />,
  local_drives: <MapPin className="h-3.5 w-3.5" />,
  fuel: <Fuel className="h-3.5 w-3.5" />,
  maintenance: <Wrench className="h-3.5 w-3.5" />,
  compliance: <ClipboardCheck className="h-3.5 w-3.5" />,
  safety_events: <AlertTriangle className="h-3.5 w-3.5" />,
  billing: <Receipt className="h-3.5 w-3.5" />,
  payments: <CreditCard className="h-3.5 w-3.5" />,
  invoices: <FileText className="h-3.5 w-3.5" />,
  tasks: <CheckSquare className="h-3.5 w-3.5" />,
  chat: <MessageSquare className="h-3.5 w-3.5" />,
  documents: <FolderOpen className="h-3.5 w-3.5" />,
  trip_expenses: <DollarSign className="h-3.5 w-3.5" />,
  business_expenses: <Briefcase className="h-3.5 w-3.5" />,
  dispatcher_payroll: <Users className="h-3.5 w-3.5" />,
  settings: <Settings className="h-3.5 w-3.5" />,
  integrations: <Plug className="h-3.5 w-3.5" />,
}

// Icon map per built-in role
const BUILT_IN_ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <ShieldCheck className="h-4 w-4 text-primary" />,
  dispatcher: <Truck className="h-4 w-4 text-blue-500" />,
  billing: <Receipt className="h-4 w-4 text-emerald-500" />,
  safety: <ShieldCheck className="h-4 w-4 text-amber-500" />,
}

const BUILT_IN_ROLE_COLORS: Record<string, string> = {
  admin: 'bg-primary/10 text-primary border-primary/20',
  dispatcher: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  billing: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  safety: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
}

export function RolesSection({ customRoles: initialRoles }: RolesSectionProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null)
  const [expandedBuiltIn, setExpandedBuiltIn] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
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
    setExpandedCategories(new Set())
  }

  function startEdit(role: CustomRole) {
    setEditingRole(role)
    setName(role.name)
    setDescription(role.description || '')
    setSelectedPermissions(role.permissions)
    setShowForm(true)
    // Pre-expand all categories that have selected permissions
    const categoriesWithSelections = new Set(
      Object.keys(PERMISSION_CATEGORIES).filter(cat =>
        (PERMISSION_CATEGORIES[cat as keyof typeof PERMISSION_CATEGORIES] as readonly string[]).some(p =>
          role.permissions.includes(p)
        )
      )
    )
    setExpandedCategories(categoriesWithSelections)
  }

  function togglePermission(perm: string) {
    setSelectedPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    )
  }

  function toggleCategory(category: string) {
    const categoryPerms: string[] = [
      ...(PERMISSION_CATEGORIES[category as keyof typeof PERMISSION_CATEGORIES] as readonly string[]),
    ]
    const allSelected = categoryPerms.every(p => selectedPermissions.includes(p))
    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(p => !categoryPerms.includes(p)))
    } else {
      setSelectedPermissions(prev => [...new Set([...prev, ...categoryPerms])])
    }
  }

  function toggleCategoryExpanded(category: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
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
      {/* Section header */}
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Roles & Permissions</CardTitle>
              <CardDescription className="text-sm">
                Manage built-in and custom roles to control what your team can access.
              </CardDescription>
            </div>
          </div>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)} className="shrink-0">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create Role
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Built-in Roles */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Built-in Roles
            </h4>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
              {Object.keys(BUILT_IN_ROLE_LABELS).length}
            </Badge>
          </div>

          <div className="space-y-2">
            {(Object.keys(BUILT_IN_ROLE_LABELS) as BuiltInRole[]).map(role => (
              <div
                key={role}
                className="rounded-xl border border-border/60 bg-muted/20 transition-colors hover:bg-muted/30"
              >
                <button
                  className="flex w-full items-center justify-between px-4 py-3"
                  onClick={() => setExpandedBuiltIn(expandedBuiltIn === role ? null : role)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${BUILT_IN_ROLE_COLORS[role] ?? 'bg-muted text-muted-foreground border-border'}`}>
                      {BUILT_IN_ROLE_ICONS[role]}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{BUILT_IN_ROLE_LABELS[role]}</span>
                        <Badge
                          variant="outline"
                          className="text-xs px-1.5 py-0 h-4 font-normal text-muted-foreground"
                        >
                          Built-in
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {role === 'admin'
                          ? 'Full access to all resources'
                          : `${BUILT_IN_ROLES[role].length} permission group${BUILT_IN_ROLES[role].length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock className="h-3 w-3 text-muted-foreground/60" />
                    {expandedBuiltIn === role ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {expandedBuiltIn === role && (
                  <div className="border-t border-border/40 px-4 py-3">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Permissions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {BUILT_IN_ROLES[role].map(perm => (
                        <Badge
                          key={perm}
                          variant="outline"
                          className="text-xs font-mono px-2 py-0.5 bg-background/60"
                        >
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator className="opacity-50" />

        {/* Custom Roles Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Custom Roles
              </h4>
              {initialRoles.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                  {initialRoles.length}
                </Badge>
              )}
            </div>
            {!showForm && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowForm(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                New
              </Button>
            )}
          </div>

          {initialRoles.length === 0 && !showForm && (
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-6 py-8 text-center">
              <Shield className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No custom roles yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
                Create roles to fine-tune access for specific team members.
              </p>
              <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create your first role
              </Button>
            </div>
          )}

          {initialRoles.length > 0 && (
            <div className="space-y-2">
              {initialRoles.map(role => (
                <div
                  key={role.id}
                  className="group rounded-xl border border-border/60 bg-card/60 p-4 shadow-xs transition-all hover:border-border hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 border border-border/60">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{role.name}</span>
                          <Badge
                            variant="secondary"
                            className="text-xs px-1.5 py-0 h-4"
                          >
                            {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        {role.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {role.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {role.permissions.slice(0, 5).map(p => (
                            <Badge
                              key={p}
                              variant="outline"
                              className="text-xs font-mono px-1.5 py-0 bg-background/60"
                            >
                              {p}
                            </Badge>
                          ))}
                          {role.permissions.length > 5 && (
                            <Badge
                              variant="outline"
                              className="text-xs px-1.5 py-0 text-muted-foreground"
                            >
                              +{role.permissions.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(role)}
                        title="Edit role"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(role.id)}
                        disabled={deleting === role.id}
                        title="Delete role"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create / Edit Form */}
        {showForm && (
          <div className="rounded-xl border border-primary/30 bg-card/60 shadow-sm overflow-hidden">
            {/* Accent top border */}
            <div className="h-0.5 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

            <div className="p-5 space-y-5">
              {/* Form header */}
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  {editingRole ? (
                    <Pencil className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold">
                    {editingRole ? `Edit Role: ${editingRole.name}` : 'Create Custom Role'}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {editingRole
                      ? 'Update permissions for this role.'
                      : 'Define a new role with specific permissions.'}
                  </p>
                </div>
              </div>

              <Separator className="opacity-60" />

              {/* Name + Description */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Role Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Accountant, Fleet Manager"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={100}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Description <span className="text-muted-foreground/60">(optional)</span>
                  </label>
                  <Input
                    placeholder="Brief description of this role"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    maxLength={500}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Permissions grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-semibold">Permissions</h5>
                    <p className="text-xs text-muted-foreground">
                      Select the resources and actions this role can access.
                    </p>
                  </div>
                  {selectedPermissions.length > 0 && (
                    <Badge className="text-xs">
                      {selectedPermissions.length} selected
                    </Badge>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                  {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => {
                    const permList = perms as readonly string[]
                    const selectedCount = permList.filter(p =>
                      selectedPermissions.includes(p)
                    ).length
                    const allSelected = selectedCount === permList.length
                    const someSelected = selectedCount > 0 && !allSelected
                    const isExpanded = expandedCategories.has(category)

                    return (
                      <div
                        key={category}
                        className="rounded-lg border border-border/60 bg-muted/10 overflow-hidden transition-colors hover:bg-muted/20"
                      >
                        {/* Category header */}
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <Checkbox
                            id={`cat-${category}`}
                            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                            onCheckedChange={() => toggleCategory(category)}
                          />
                          <button
                            type="button"
                            className="flex flex-1 items-center gap-2 min-w-0"
                            onClick={() => toggleCategoryExpanded(category)}
                          >
                            <span className="text-muted-foreground shrink-0">
                              {CATEGORY_ICONS[category]}
                            </span>
                            <span className="text-xs font-semibold truncate flex-1 text-left">
                              {CATEGORY_LABELS[category] ?? category}
                            </span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {selectedCount}/{permList.length}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              )}
                            </span>
                          </button>
                        </div>

                        {/* Individual permissions */}
                        {isExpanded && (
                          <div className="border-t border-border/40 px-3 py-2 space-y-1.5 bg-background/40">
                            {permList.map(perm => {
                              const action = perm.split('.')[1]
                              return (
                                <div key={perm} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`perm-${perm}`}
                                    checked={selectedPermissions.includes(perm)}
                                    onCheckedChange={(checked) =>
                                      togglePermission(perm)
                                    }
                                  />
                                  <label
                                    htmlFor={`perm-${perm}`}
                                    className="text-xs text-muted-foreground capitalize cursor-pointer select-none flex-1"
                                  >
                                    {action}
                                  </label>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Form actions */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  {selectedPermissions.length === 0
                    ? 'Select at least one permission to continue.'
                    : `${selectedPermissions.length} permission${selectedPermissions.length !== 1 ? 's' : ''} selected`}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={resetForm} className="h-8">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || !name.trim() || selectedPermissions.length === 0}
                    className="h-8"
                  >
                    {saving
                      ? 'Saving...'
                      : editingRole
                        ? 'Update Role'
                        : 'Create Role'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
