import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useAuth } from '@/contexts/auth-context'
import {
  collectionQueryKey,
  useRealtimeCollection,
  useTypedCollectionQuery,
} from '@/hooks/use-collection'
import pb, { COLLECTIONS } from '@/lib/pocketbase'
import { formatDateTime } from '@/lib/utils'
import { deleteRecord, updateRecord } from '@/services/crud'
import type { UserRecord } from '@/types'
import { getLabel, ROLE_LABELS } from '@/utils/constants'

const USERS_LIST_OPTIONS = { sort: '-created' }
const USERS_QUERY_KEY = collectionQueryKey(COLLECTIONS.USERS, USERS_LIST_OPTIONS)

const baseUserFields = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum([
    'administrator',
    'inventory_manager',
    'purchase',
    'sales',
    'store_keeper',
    'read_only',
  ]),
})

const createUserSchema = baseUserFields
  .extend({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    passwordConfirm: z.string().min(8, 'Please confirm password'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Passwords do not match',
    path: ['passwordConfirm'],
  })

const editUserSchema = baseUserFields

type CreateUserFormValues = z.infer<typeof createUserSchema>
type EditUserFormValues = z.infer<typeof editUserSchema>

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null)

  useRealtimeCollection(COLLECTIONS.USERS, USERS_QUERY_KEY)

  const { data: usersData, isLoading } = useTypedCollectionQuery(
    COLLECTIONS.USERS,
    USERS_LIST_OPTIONS,
  )

  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      name: '',
      role: 'read_only',
      password: '',
      passwordConfirm: '',
    },
  })

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      email: '',
      name: '',
      role: 'read_only',
    },
  })

  const createMutation = useMutation({
    mutationFn: async (values: CreateUserFormValues) => {
      return pb.collection(COLLECTIONS.USERS).create({
        email: values.email,
        password: values.password,
        passwordConfirm: values.passwordConfirm,
        name: values.name,
        role: values.role,
        emailVisibility: true,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
      toast.success('User created')
      setCreateOpen(false)
      createForm.reset()
    },
    onError: () => toast.error('Failed to create user'),
  })

  const updateMutation = useMutation({
    mutationFn: (values: EditUserFormValues & { id: string }) =>
      updateRecord(COLLECTIONS.USERS, values.id, {
        name: values.name,
        role: values.role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
      toast.success('User updated')
      setEditingUser(null)
    },
    onError: () => toast.error('Failed to update user'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecord(COLLECTIONS.USERS, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
      toast.success('User deleted')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Failed to delete user'),
  })

  const openEdit = (user: UserRecord) => {
    setEditingUser(user)
    editForm.reset({
      name: user.name,
      email: user.email,
      role: user.role,
    })
  }

  const columns: ColumnDef<UserRecord>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.name}
          {row.original.id === currentUser?.id && (
            <Badge variant="outline" className="text-xs">
              You
            </Badge>
          )}
        </div>
      ),
    },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => getLabel(ROLE_LABELS, row.original.role),
    },
    {
      accessorKey: 'created',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => formatDateTime(row.original.created),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const isSelf = row.original.id === currentUser?.id
        return (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={isSelf}
              title={isSelf ? 'Cannot delete your own account' : 'Delete user'}
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage user accounts and roles."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New User
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Administrator access required</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={usersData?.items ?? []}
            searchKey="name"
            searchPlaceholder="Search users..."
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Add a new user account to the system.</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="user@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROLE_LABELS.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="passwordConfirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create User
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update name and role for {editingUser?.email}</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit((values) =>
                editingUser &&
                updateMutation.mutate({ ...values, id: editingUser.id }),
              )}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input disabled {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={editingUser?.id === currentUser?.id}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROLE_LABELS.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editingUser?.id === currentUser?.id && (
                      <p className="text-xs text-muted-foreground">
                        You cannot change your own role.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete User"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  )
}
