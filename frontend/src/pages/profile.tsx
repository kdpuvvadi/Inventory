import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/page-header'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/auth-context'
import pb, { COLLECTIONS } from '@/lib/pocketbase'
import { formatDateTime, getInitials } from '@/lib/utils'
import { profileSchema, type ProfileFormValues } from '@/schemas'
import { getLabel, ROLE_LABELS } from '@/utils/constants'

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Current password is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    passwordConfirm: z.string().min(8, 'Please confirm password'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Passwords do not match',
    path: ['passwordConfirm'],
  })

type PasswordFormValues = z.infer<typeof passwordSchema>

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      name: user?.name ?? '',
      email: user?.email ?? '',
    },
  })

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      oldPassword: '',
      password: '',
      passwordConfirm: '',
    },
  })

  const onProfileSubmit = async (values: ProfileFormValues) => {
    if (!user) return
    setProfileSubmitting(true)
    try {
      await pb.collection(COLLECTIONS.USERS).update(user.id, {
        name: values.name,
        email: values.email,
      })
      await refreshUser()
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setProfileSubmitting(false)
    }
  }

  const onPasswordSubmit = async (values: PasswordFormValues) => {
    if (!user) return
    setPasswordSubmitting(true)
    try {
      await pb.collection(COLLECTIONS.USERS).update(user.id, {
        oldPassword: values.oldPassword,
        password: values.password,
        passwordConfirm: values.passwordConfirm,
      })
      passwordForm.reset()
      toast.success('Password changed successfully')
    } catch {
      toast.error('Failed to change password. Check your current password.')
    } finally {
      setPasswordSubmitting(false)
    }
  }

  if (!user) {
    return null
  }

  const avatarUrl = user.avatar
    ? pb.files.getURL(user, user.avatar, { thumb: '100x100' })
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Manage your account information and security settings."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="text-center">
            <div className="mx-auto">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarUrl} alt={user.name} />
                <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle className="mt-4">{user.name}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <Badge variant="outline">{getLabel(ROLE_LABELS, user.role)}</Badge>
            <p className="text-xs text-muted-foreground">
              Member since {formatDateTime(user.created)}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
              <CardDescription>Update your name and email address.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form
                  onSubmit={profileForm.handleSubmit(onProfileSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={profileForm.control}
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
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={profileSubmitting}>
                    {profileSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Profile
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Use a strong password with at least 8 characters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={passwordForm.control}
                    name="oldPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="current-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Separator />
                  <FormField
                    control={passwordForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="passwordConfirm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={passwordSubmitting}>
                    {passwordSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Change Password
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
