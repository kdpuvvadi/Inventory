import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { RecordModel } from 'pocketbase'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  collectionQueryKey,
  useRealtimeCollection,
  useTypedCollectionQuery,
} from '@/hooks/use-collection'
import { canWrite } from '@/lib/auth'
import { COLLECTIONS } from '@/lib/pocketbase'
import {
  contactSchema,
  departmentSchema,
  type DepartmentFormValues,
} from '@/schemas'
import { logAudit } from '@/services/audit'
import { createRecord, deleteRecord, updateRecord } from '@/services/crud'
import type { Contact, Department } from '@/types'
import { DEPARTMENT_PRESETS } from '@/utils/constants'

type EntityType = 'manufacturer' | 'supplier' | 'customer'

const ENTITY_FIELD: Record<EntityType, 'manufacturer' | 'supplier' | 'customer'> = {
  manufacturer: 'manufacturer',
  supplier: 'supplier',
  customer: 'customer',
}

const PRESET_VALUES = DEPARTMENT_PRESETS.map((p) => p.value)
const CUSTOM_PRESET = '__custom__'

type ContactFormInput = z.input<typeof contactSchema>
type ContactFormOutput = z.output<typeof contactSchema>

interface CompanyContactsPanelProps {
  entityType: EntityType
  entityId: string
}

function buildDepartmentFilter(ids: string[]): string | undefined {
  if (ids.length === 0) return undefined
  return ids.map((id) => `department = "${id}"`).join(' || ')
}

export function CompanyContactsPanel({
  entityType,
  entityId,
}: CompanyContactsPanelProps) {
  const writeAccess = canWrite()
  const queryClient = useQueryClient()
  const entityField = ENTITY_FIELD[entityType]

  const departmentsOptions = useMemo(
    () => ({
      filter: `${entityField} = "${entityId}"`,
      sort: 'name',
      perPage: 100,
    }),
    [entityField, entityId],
  )

  const departmentsQueryKey = useMemo(
    () => collectionQueryKey(COLLECTIONS.DEPARTMENTS, departmentsOptions),
    [departmentsOptions],
  )

  const { data: departmentsData, isLoading: departmentsLoading } =
    useTypedCollectionQuery('departments', departmentsOptions)

  useRealtimeCollection(COLLECTIONS.DEPARTMENTS, departmentsQueryKey)

  const departments = departmentsData?.items ?? []
  const departmentIds = useMemo(
    () => departments.map((d) => d.id),
    [departments],
  )

  const contactsOptions = useMemo(
    () => ({
      filter: buildDepartmentFilter(departmentIds) ?? 'id = ""',
      sort: 'name',
      perPage: 500,
    }),
    [departmentIds],
  )

  const contactsQueryKey = useMemo(
    () => collectionQueryKey(COLLECTIONS.CONTACTS, contactsOptions),
    [contactsOptions],
  )

  const { data: contactsData, isLoading: contactsLoading } =
    useTypedCollectionQuery('contacts', contactsOptions)

  useRealtimeCollection(COLLECTIONS.CONTACTS, contactsQueryKey)

  const contactsByDepartment = useMemo(() => {
    const map = new Map<string, Contact[]>()
    for (const dept of departments) {
      map.set(dept.id, [])
    }
    for (const contact of contactsData?.items ?? []) {
      const list = map.get(contact.department)
      if (list) {
        list.push(contact)
      }
    }
    return map
  }, [departments, contactsData])

  const invalidateQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: departmentsQueryKey })
    void queryClient.invalidateQueries({ queryKey: contactsQueryKey })
    void queryClient.invalidateQueries({ queryKey: ['collection', COLLECTIONS.DEPARTMENTS] })
    void queryClient.invalidateQueries({ queryKey: ['collection', COLLECTIONS.CONTACTS] })
  }, [queryClient, departmentsQueryKey, contactsQueryKey])

  const [deptDialogOpen, setDeptDialogOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [deleteDepartmentTarget, setDeleteDepartmentTarget] = useState<Department | null>(null)

  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [contactDefaultDeptId, setContactDefaultDeptId] = useState<string>('')
  const [deleteContactTarget, setDeleteContactTarget] = useState<Contact | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [deptPreset, setDeptPreset] = useState<string>(PRESET_VALUES[0])
  const [customDeptName, setCustomDeptName] = useState('')

  const deptForm = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: '', notes: '' },
  })

  const contactForm = useForm<ContactFormInput, unknown, ContactFormOutput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      department: '',
      name: '',
      title: '',
      email: '',
      phone: '',
      mobile: '',
      notes: '',
      is_primary: false,
    },
  })

  useEffect(() => {
    if (!deptDialogOpen) return
    if (editingDepartment) {
      const isPreset = PRESET_VALUES.includes(editingDepartment.name)
      if (isPreset) {
        setDeptPreset(editingDepartment.name)
        setCustomDeptName('')
      } else {
        setDeptPreset(CUSTOM_PRESET)
        setCustomDeptName(editingDepartment.name)
      }
      deptForm.reset({
        name: editingDepartment.name,
        notes: editingDepartment.notes ?? '',
      })
    } else {
      setDeptPreset(PRESET_VALUES[0])
      setCustomDeptName('')
      deptForm.reset({ name: PRESET_VALUES[0], notes: '' })
    }
  }, [deptDialogOpen, editingDepartment, deptForm])

  useEffect(() => {
    if (!contactDialogOpen) return
    if (editingContact) {
      contactForm.reset({
        department: editingContact.department,
        name: editingContact.name ?? '',
        title: editingContact.title ?? '',
        email: editingContact.email ?? '',
        phone: editingContact.phone ?? '',
        mobile: editingContact.mobile ?? '',
        notes: editingContact.notes ?? '',
        is_primary: editingContact.is_primary ?? false,
      })
    } else {
      contactForm.reset({
        department: contactDefaultDeptId || departments[0]?.id || '',
        name: '',
        title: '',
        email: '',
        phone: '',
        mobile: '',
        notes: '',
        is_primary: false,
      })
    }
  }, [contactDialogOpen, editingContact, contactDefaultDeptId, departments, contactForm])

  const resolveDeptName = (): string => {
    if (deptPreset === CUSTOM_PRESET) {
      return customDeptName.trim()
    }
    return deptPreset
  }

  const openCreateDepartment = () => {
    setEditingDepartment(null)
    setDeptDialogOpen(true)
  }

  const openEditDepartment = (dept: Department) => {
    setEditingDepartment(dept)
    setDeptDialogOpen(true)
  }

  const openCreateContact = (deptId?: string) => {
    setEditingContact(null)
    setContactDefaultDeptId(deptId ?? '')
    setContactDialogOpen(true)
  }

  const openEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setContactDialogOpen(true)
  }

  const clearPrimaryInDepartment = async (departmentId: string, excludeId?: string) => {
    const deptContacts = contactsByDepartment.get(departmentId) ?? []
    const others = deptContacts.filter(
      (c) => c.is_primary && c.id !== excludeId,
    )
    for (const other of others) {
      await updateRecord<Contact & RecordModel>(COLLECTIONS.CONTACTS, other.id, {
        is_primary: false,
      })
    }
  }

  const handleSaveDepartment = async (values: DepartmentFormValues) => {
    const name = resolveDeptName()
    if (!name) {
      toast.error('Department name is required')
      return
    }

    setIsSaving(true)
    try {
      const payload = { name, notes: values.notes ?? '' }

      if (editingDepartment) {
        const updated = await updateRecord<Department & RecordModel>(
          COLLECTIONS.DEPARTMENTS,
          editingDepartment.id,
          payload,
        )
        await logAudit({
          action: 'update',
          collection: COLLECTIONS.DEPARTMENTS,
          recordId: updated.id,
          previousValue: editingDepartment as unknown as Record<string, unknown>,
          newValue: updated as unknown as Record<string, unknown>,
        })
        toast.success('Department updated')
      } else {
        const created = await createRecord<Department & RecordModel>(
          COLLECTIONS.DEPARTMENTS,
          { ...payload, [entityField]: entityId },
        )
        await logAudit({
          action: 'create',
          collection: COLLECTIONS.DEPARTMENTS,
          recordId: created.id,
          newValue: created as unknown as Record<string, unknown>,
        })
        toast.success('Department created')
      }

      setDeptDialogOpen(false)
      setEditingDepartment(null)
      invalidateQueries()
    } catch {
      toast.error(
        editingDepartment ? 'Failed to update department' : 'Failed to create department',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveContact = async (values: ContactFormOutput) => {
    setIsSaving(true)
    try {
      const payload = {
        department: values.department,
        name: values.name,
        title: values.title ?? '',
        email: values.email ?? '',
        phone: values.phone ?? '',
        mobile: values.mobile ?? '',
        notes: values.notes ?? '',
        is_primary: values.is_primary ?? false,
      }

      if (values.is_primary) {
        await clearPrimaryInDepartment(values.department, editingContact?.id)
      }

      if (editingContact) {
        const updated = await updateRecord<Contact & RecordModel>(
          COLLECTIONS.CONTACTS,
          editingContact.id,
          payload,
        )
        await logAudit({
          action: 'update',
          collection: COLLECTIONS.CONTACTS,
          recordId: updated.id,
          previousValue: editingContact as unknown as Record<string, unknown>,
          newValue: updated as unknown as Record<string, unknown>,
        })
        toast.success('Contact updated')
      } else {
        const created = await createRecord<Contact & RecordModel>(
          COLLECTIONS.CONTACTS,
          payload,
        )
        await logAudit({
          action: 'create',
          collection: COLLECTIONS.CONTACTS,
          recordId: created.id,
          newValue: created as unknown as Record<string, unknown>,
        })
        toast.success('Contact created')
      }

      setContactDialogOpen(false)
      setEditingContact(null)
      invalidateQueries()
    } catch {
      toast.error(editingContact ? 'Failed to update contact' : 'Failed to create contact')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteDepartment = async () => {
    if (!deleteDepartmentTarget) return
    setIsDeleting(true)
    try {
      const deptContacts = contactsByDepartment.get(deleteDepartmentTarget.id) ?? []
      for (const contact of deptContacts) {
        await deleteRecord(COLLECTIONS.CONTACTS, contact.id)
        await logAudit({
          action: 'delete',
          collection: COLLECTIONS.CONTACTS,
          recordId: contact.id,
          previousValue: contact as unknown as Record<string, unknown>,
        })
      }

      await deleteRecord(COLLECTIONS.DEPARTMENTS, deleteDepartmentTarget.id)
      await logAudit({
        action: 'delete',
        collection: COLLECTIONS.DEPARTMENTS,
        recordId: deleteDepartmentTarget.id,
        previousValue: deleteDepartmentTarget as unknown as Record<string, unknown>,
      })

      toast.success('Department deleted')
      setDeleteDepartmentTarget(null)
      invalidateQueries()
    } catch {
      toast.error('Failed to delete department')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteContact = async () => {
    if (!deleteContactTarget) return
    setIsDeleting(true)
    try {
      await deleteRecord(COLLECTIONS.CONTACTS, deleteContactTarget.id)
      await logAudit({
        action: 'delete',
        collection: COLLECTIONS.CONTACTS,
        recordId: deleteContactTarget.id,
        previousValue: deleteContactTarget as unknown as Record<string, unknown>,
      })
      toast.success('Contact deleted')
      setDeleteContactTarget(null)
      invalidateQueries()
    } catch {
      toast.error('Failed to delete contact')
    } finally {
      setIsDeleting(false)
    }
  }

  const deleteDeptContactCount = deleteDepartmentTarget
    ? (contactsByDepartment.get(deleteDepartmentTarget.id)?.length ?? 0)
    : 0

  const isLoading = departmentsLoading || (departmentIds.length > 0 && contactsLoading)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Departments &amp; Contacts</h2>
          <p className="text-sm text-muted-foreground">
            Organize contacts by department for this {entityType}.
          </p>
        </div>
        {writeAccess && (
          <Button size="sm" onClick={openCreateDepartment}>
            <Plus className="mr-2 h-4 w-4" />
            Add Department
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : departments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No departments"
          description="Add departments to organize contacts for this company."
          action={
            writeAccess ? (
              <Button onClick={openCreateDepartment}>
                <Plus className="mr-2 h-4 w-4" />
                Add Department
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {departments.map((dept) => {
            const contacts = contactsByDepartment.get(dept.id) ?? []
            return (
              <Card key={dept.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{dept.name}</CardTitle>
                    {dept.notes && (
                      <CardDescription>{dept.notes}</CardDescription>
                    )}
                  </div>
                  {writeAccess && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCreateContact(dept.id)}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Contact
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDepartment(dept)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteDepartmentTarget(dept)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No contacts in this department.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Mobile</TableHead>
                          {writeAccess && <TableHead className="w-24">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map((contact) => (
                          <TableRow key={contact.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <UserRound className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{contact.name}</span>
                                {contact.is_primary && (
                                  <Badge variant="success">Primary</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{contact.title || '—'}</TableCell>
                            <TableCell>
                              {contact.email ? (
                                <a
                                  href={`mailto:${contact.email}`}
                                  className="text-primary hover:underline"
                                >
                                  {contact.email}
                                </a>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell>{contact.phone || '—'}</TableCell>
                            <TableCell>{contact.mobile || '—'}</TableCell>
                            {writeAccess && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEditContact(contact)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteContactTarget(contact)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? 'Edit Department' : 'Add Department'}
            </DialogTitle>
            <DialogDescription>
              Choose a preset department name or enter a custom one.
            </DialogDescription>
          </DialogHeader>
          <Form {...deptForm}>
            <form
              onSubmit={deptForm.handleSubmit(handleSaveDepartment)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <FormLabel>Department Name</FormLabel>
                <Select
                  value={deptPreset}
                  onValueChange={(value) => {
                    setDeptPreset(value)
                    if (value !== CUSTOM_PRESET) {
                      deptForm.setValue('name', value)
                    } else {
                      deptForm.setValue('name', customDeptName)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_PRESET}>Custom name…</SelectItem>
                  </SelectContent>
                </Select>
                {deptPreset === CUSTOM_PRESET && (
                  <Input
                    placeholder="Enter custom department name"
                    value={customDeptName}
                    onChange={(e) => {
                      setCustomDeptName(e.target.value)
                      deptForm.setValue('name', e.target.value)
                    }}
                  />
                )}
              </div>
              <FormField
                control={deptForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional notes about this department"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeptDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingDepartment ? 'Save Changes' : 'Add Department'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Edit Contact' : 'Add Contact'}
            </DialogTitle>
            <DialogDescription>
              Add a contact person within a department.
            </DialogDescription>
          </DialogHeader>
          <Form {...contactForm}>
            <form
              onSubmit={contactForm.handleSubmit(handleSaveContact)}
              className="space-y-4"
            >
              <FormField
                control={contactForm.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Sales Manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={contactForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Office phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={contactForm.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile</FormLabel>
                    <FormControl>
                      <Input placeholder="Mobile phone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="is_primary"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Primary Contact</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Mark as the main contact for this department.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional notes" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setContactDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingContact ? 'Save Changes' : 'Add Contact'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteDepartmentTarget)}
        onOpenChange={(open) => !open && setDeleteDepartmentTarget(null)}
        title="Delete Department"
        description={
          deleteDeptContactCount > 0
            ? `This department has ${deleteDeptContactCount} contact${deleteDeptContactCount === 1 ? '' : 's'}. Deleting the department will also delete all associated contacts. This action cannot be undone.`
            : 'Are you sure you want to delete this department? This action cannot be undone.'
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteDepartment}
        loading={isDeleting}
        destructive
      />

      <ConfirmDialog
        open={Boolean(deleteContactTarget)}
        onOpenChange={(open) => !open && setDeleteContactTarget(null)}
        title="Delete Contact"
        description="Are you sure you want to delete this contact? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteContact}
        loading={isDeleting}
        destructive
      />
    </div>
  )
}
