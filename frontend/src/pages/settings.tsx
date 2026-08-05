import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { RecordModel } from 'pocketbase'

import { PageHeader } from '@/components/layout/page-header'
import { StateSelect } from '@/components/state-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Textarea } from '@/components/ui/textarea'
import { SETTINGS_QUERY_KEY } from '@/contexts/settings-context'
import { useTheme } from '@/contexts/theme-context'
import pb, { COLLECTIONS } from '@/lib/pocketbase'
import { normalizeCurrencyCode } from '@/lib/utils'
import { settingsSchema, type SettingsFormValues } from '@/schemas'
import { createRecord } from '@/services/crud'
import type { AppSettings } from '@/types'
import { stripHtml } from '@/utils/documents'

const DEFAULT_SETTINGS: SettingsFormValues = {
  company_name: 'My Company',
  site_name: '',
  currency: 'USD',
  low_stock_threshold: 10,
  theme_default: 'system',
  company_address: '',
  company_state: '',
  company_pincode: '',
  company_email: '',
  company_phone: '',
  gst_number: '',
  default_tax_rate: 0,
  quotation_prefix: 'QT-',
  invoice_prefix: 'INV-',
  proforma_prefix: 'PI-',
  header_show_logo: true,
  header_show_address: true,
  header_show_email: true,
  header_show_phone: true,
  header_show_gst: true,
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

function settingsToFormValues(settings: AppSettings): SettingsFormValues {
  const themeDefault =
    settings.theme_default === 'light' ||
    settings.theme_default === 'dark' ||
    settings.theme_default === 'system'
      ? settings.theme_default
      : 'system'

  return {
    company_name: settings.company_name || DEFAULT_SETTINGS.company_name,
    site_name: settings.site_name || '',
    currency: normalizeCurrencyCode(settings.currency || DEFAULT_SETTINGS.currency),
    low_stock_threshold:
      settings.low_stock_threshold ?? DEFAULT_SETTINGS.low_stock_threshold,
    theme_default: themeDefault,
    company_address: stripHtml(settings.company_address) || '',
    company_state: settings.company_state || '',
    company_pincode: settings.company_pincode || '',
    company_email: settings.company_email || '',
    company_phone: settings.company_phone || '',
    gst_number: settings.gst_number || '',
    default_tax_rate: settings.default_tax_rate ?? 0,
    quotation_prefix: settings.quotation_prefix || 'QT-',
    invoice_prefix: settings.invoice_prefix || 'INV-',
    proforma_prefix: settings.proforma_prefix || 'PI-',
    header_show_logo: settings.header_show_logo ?? true,
    header_show_address: settings.header_show_address ?? true,
    header_show_email: settings.header_show_email ?? true,
    header_show_phone: settings.header_show_phone ?? true,
    header_show_gst: settings.header_show_gst ?? true,
  }
}

async function fetchOrCreateSettings(): Promise<AppSettings> {
  const result = await pb.collection(COLLECTIONS.APP_SETTINGS).getList<AppSettings>(1, 1)
  if (result.items.length > 0) {
    return result.items[0]
  }
  return createRecord<AppSettings & RecordModel>(COLLECTIONS.APP_SETTINGS, {
    ...DEFAULT_SETTINGS,
    company_address: '',
  })
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { theme, setTheme } = useTheme()
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchOrCreateSettings,
  })

  const formValues = useMemo(
    () => (settings ? settingsToFormValues(settings) : DEFAULT_SETTINGS),
    [settings],
  )

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    values: formValues,
  })

  const existingLogoUrl = useMemo(() => {
    if (!settings?.company_logo || removeLogo) return null
    try {
      return pb.files.getURL(settings, settings.company_logo, { thumb: '200x200' })
    } catch {
      return null
    }
  }, [settings, removeLogo])

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null)
      return
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logoFile])

  const saveMutation = useMutation({
    mutationFn: async (values: SettingsFormValues) => {
      if (!settings) throw new Error('Settings not loaded')

      const formData = new FormData()
      formData.append('company_name', values.company_name)
      formData.append('site_name', values.site_name || '')
      formData.append('currency', normalizeCurrencyCode(values.currency))
      formData.append('low_stock_threshold', String(values.low_stock_threshold))
      formData.append('theme_default', values.theme_default)
      formData.append('company_address', values.company_address || '')
      formData.append('company_state', values.company_state || '')
      formData.append('company_pincode', values.company_pincode || '')
      formData.append('company_email', values.company_email || '')
      formData.append('company_phone', values.company_phone || '')
      formData.append('gst_number', values.gst_number || '')
      formData.append('default_tax_rate', String(values.default_tax_rate ?? 0))
      formData.append('quotation_prefix', values.quotation_prefix || 'QT-')
      formData.append('invoice_prefix', values.invoice_prefix || 'INV-')
      formData.append('proforma_prefix', values.proforma_prefix || 'PI-')
      formData.append('header_show_logo', String(values.header_show_logo ?? true))
      formData.append('header_show_address', String(values.header_show_address ?? true))
      formData.append('header_show_email', String(values.header_show_email ?? true))
      formData.append('header_show_phone', String(values.header_show_phone ?? true))
      formData.append('header_show_gst', String(values.header_show_gst ?? true))

      if (logoFile) {
        formData.append('company_logo', logoFile)
      } else if (removeLogo) {
        formData.append('company_logo', '')
      }

      return pb.collection(COLLECTIONS.APP_SETTINGS).update<AppSettings>(
        settings.id,
        formData,
      )
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated)
      void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
      setLogoFile(null)
      setRemoveLogo(false)
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

  const displayLogo = logoPreview || existingLogoUrl

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure company details and application preferences."
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                Site name and logo shown in the app title and sidebar.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-w-lg space-y-6">
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
                name="site_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Leave blank to use company name"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Shown in the browser tab and sidebar. Falls back to company name.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Company Logo</FormLabel>
                <div className="flex items-center gap-4">
                  {displayLogo ? (
                    <img
                      src={displayLogo}
                      alt="Company logo"
                      className="h-16 w-16 rounded border object-contain bg-background"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                      No logo
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <label className="cursor-pointer">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              setLogoFile(file)
                              setRemoveLogo(false)
                            }
                          }}
                        />
                      </label>
                    </Button>
                    {(displayLogo || settings?.company_logo) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLogoFile(null)
                          setRemoveLogo(true)
                        }}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Company Details</CardTitle>
              <CardDescription>
                Address and contact details used on document headers.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-w-lg space-y-6">
              <FormField
                control={form.control}
                name="company_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Street, City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="company_state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <StateSelect
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company_pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <Input placeholder="Pincode" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="company_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="billing@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 98765 43210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gst_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST Number</FormLabel>
                    <FormControl>
                      <Input placeholder="22AAAAA0000A1Z5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Document Header</CardTitle>
              <CardDescription>
                Choose which company details appear on PDF headers.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-lg gap-4 sm:grid-cols-2">
              {(
                [
                  ['header_show_logo', 'Show logo'],
                  ['header_show_address', 'Show address'],
                  ['header_show_email', 'Show email'],
                  ['header_show_phone', 'Show phone'],
                  ['header_show_gst', 'Show GST number'],
                ] as const
              ).map(([name, label]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value ?? true}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">{label}</FormLabel>
                    </FormItem>
                  )}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Document Number Formats</CardTitle>
              <CardDescription>
                Prefixes used when generating quotations, invoices, and proformas.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-lg gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="quotation_prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quotation</FormLabel>
                    <FormControl>
                      <Input placeholder="QT-" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invoice_prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice</FormLabel>
                    <FormControl>
                      <Input placeholder="INV-" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="proforma_prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proforma</FormLabel>
                    <FormControl>
                      <Input placeholder="PI-" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Application Settings</CardTitle>
              <CardDescription>
                These settings apply globally across the inventory system.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-w-lg space-y-6">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select
                      key={`currency-${field.value}`}
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
                      Currently selected: {normalizeCurrencyCode(field.value || 'USD')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_tax_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Tax Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="100" step="0.01" {...field} />
                    </FormControl>
                    <FormDescription>
                      Applied as the default line-item tax on new documents.
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
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  )
}
