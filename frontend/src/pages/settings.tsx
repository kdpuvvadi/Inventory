import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { RecordModel } from 'pocketbase'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
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
import { SETTINGS_QUERY_KEY } from '@/contexts/settings-context'
import { useTheme } from '@/contexts/theme-context'
import pb, { COLLECTIONS } from '@/lib/pocketbase'
import { normalizeCurrencyCode } from '@/lib/utils'
import { settingsSchema, type SettingsFormValues } from '@/schemas'
import { createRecord, updateRecord } from '@/services/crud'
import type { AppSettings } from '@/types'

const DEFAULT_SETTINGS: SettingsFormValues = {
  company_name: 'My Company',
  currency: 'USD',
  low_stock_threshold: 10,
  theme_default: 'system',
}

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
] as const

async function fetchOrCreateSettings(): Promise<AppSettings> {
  const result = await pb.collection(COLLECTIONS.APP_SETTINGS).getList<AppSettings>(1, 1)
  if (result.items.length > 0) {
    return result.items[0]
  }
  return createRecord<AppSettings & RecordModel>(COLLECTIONS.APP_SETTINGS, DEFAULT_SETTINGS)
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()

  const { data: settings, isLoading } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchOrCreateSettings,
  })

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: DEFAULT_SETTINGS,
  })

  useEffect(() => {
    if (settings) {
      const themeDefault =
        settings.theme_default === 'light' ||
        settings.theme_default === 'dark' ||
        settings.theme_default === 'system'
          ? settings.theme_default
          : 'system'
      form.reset({
        company_name: settings.company_name || DEFAULT_SETTINGS.company_name,
        currency: normalizeCurrencyCode(
          settings.currency || DEFAULT_SETTINGS.currency,
        ),
        low_stock_threshold:
          settings.low_stock_threshold ?? DEFAULT_SETTINGS.low_stock_threshold,
        theme_default: themeDefault,
      })
    }
  }, [settings, form])

  const saveMutation = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      if (!settings) throw new Error('Settings not loaded')
      const payload = {
        ...values,
        currency: normalizeCurrencyCode(values.currency),
      }
      return updateRecord<AppSettings & RecordModel>(
        COLLECTIONS.APP_SETTINGS,
        settings.id,
        payload,
      )
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated)
      void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      if (
        updated.theme_default === 'light' ||
        updated.theme_default === 'dark' ||
        updated.theme_default === 'system'
      ) {
        setTheme(updated.theme_default)
      }
      toast.success('Settings saved')
    },
    onError: () => toast.error('Failed to save settings'),
  })

  const onSubmit = (values: SettingsFormValues) => {
    saveMutation.mutate(values)
    if (
      values.theme_default === 'light' ||
      values.theme_default === 'dark' ||
      values.theme_default === 'system'
    ) {
      setTheme(values.theme_default)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" description="Configure application preferences." />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure company details and application preferences."
      />

      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>
            These settings apply globally across the inventory system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-lg space-y-6">
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={normalizeCurrencyCode(field.value || 'USD')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Used for product costs, inventory valuation, and reports.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="low_stock_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Low Stock Threshold</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormDescription>
                      Default reorder alert level when not set per product
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="theme_default"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Theme</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        if (value !== 'light' && value !== 'dark' && value !== 'system') {
                          return
                        }
                        field.onChange(value)
                        setTheme(value)
                      }}
                      value={field.value || 'system'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Current theme: <span className="capitalize">{theme}</span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Settings
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
