import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useSettings } from '@/contexts/settings-context'
import { useRecord, useTypedCollectionQuery } from '@/hooks/use-collection'
import { COLLECTIONS } from '@/lib/pocketbase'
import { cn, formatCurrency, normalizeCurrencyCode } from '@/lib/utils'
import { salesDocumentSchema, type SalesDocumentFormValues } from '@/schemas'
import { createRecord, deleteRecord, updateRecord } from '@/services/crud'
import type {
  Customer,
  DocumentItem,
  DocumentType,
  Product,
  SalesDocument,
} from '@/types'
import { DOCUMENT_TYPES } from '@/utils/constants'
import {
  calcDocumentTotals,
  calcLineTotals,
  generateDocumentNumber,
  resolveDocumentCurrency,
  stripHtml,
} from '@/utils/documents'

function emptyLine(taxPercent = 0): SalesDocumentFormValues['line_items'][number] {
  return {
    product: '',
    description: '',
    part_number: '',
    hsn_code: '',
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    tax_percent: taxPercent,
    save_as_product: false,
  }
}

function productLabel(product: Product): string {
  const code = product.sku || product.asset_tag || product.manufacturer_code
  return code ? `${product.name} (${code})` : product.name
}

function ProductPicker({
  products,
  value,
  onSelect,
  onClear,
}: {
  products: Product[]
  value?: string
  onSelect: (productId: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = products.find((p) => p.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter((product) => {
      const haystack = [
        product.name,
        product.sku,
        product.asset_tag,
        product.manufacturer_code,
        product.model,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [products, query])

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-auto min-h-9 w-full justify-start whitespace-normal px-3 py-2 text-left font-normal',
              !selected && 'text-muted-foreground',
            )}
          >
            {selected ? productLabel(selected) : 'Select product from catalog'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
          <Input
            placeholder="Search name, SKU, asset tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-2"
            autoFocus
          />
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No products found</p>
            ) : (
              filtered.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className={cn(
                    'flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                    product.id === value && 'bg-accent',
                  )}
                  onClick={() => {
                    onSelect(product.id)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[product.sku || product.asset_tag, product.model]
                      .filter(Boolean)
                      .join(' · ') || 'No SKU'}
                  </span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selected && (
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={onClear}>
          Use custom product instead
        </Button>
      )}
    </div>
  )
}

export default function DocumentFormPage() {
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEditing = Boolean(editId)
  const { settings, currency } = useSettings()
  const today = new Date().toISOString().slice(0, 10)
  const defaultTax = settings?.default_tax_rate ?? 0
  const [hydrated, setHydrated] = useState(false)

  const initialType = (searchParams.get('type') as DocumentType | null) ?? 'quotation'
  const validInitialType = DOCUMENT_TYPES.some((t) => t.value === initialType)
    ? initialType
    : 'quotation'

  const { data: existingDoc, isLoading: docLoading } = useRecord<SalesDocument>(
    COLLECTIONS.DOCUMENTS,
    editId,
  )

  const existingItemsOptions = useMemo(
    () => ({
      perPage: 200,
      filter: editId ? `document = "${editId}"` : 'id = ""',
      sort: 'created',
    }),
    [editId],
  )

  const { data: existingItemsData, isLoading: itemsLoading } =
    useTypedCollectionQuery('document_items', existingItemsOptions)

  const { data: customersData } = useTypedCollectionQuery('customers', {
    perPage: 200,
    sort: 'name',
  })
  const { data: productsData } = useTypedCollectionQuery('products', {
    perPage: 500,
    sort: 'name',
  })

  const form = useForm<SalesDocumentFormValues>({
    resolver: zodResolver(salesDocumentSchema),
    defaultValues: {
      document_number: generateDocumentNumber(validInitialType, settings),
      type: validInitialType,
      status: 'draft',
      customer: '',
      issue_date: today,
      due_date: '',
      currency,
      discount_percent: 0,
      tax_percent: defaultTax,
      billing_address: '',
      reference: '',
      notes: '',
      line_items: [emptyLine(defaultTax)],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'line_items',
  })

  const watchedType = useWatch({ control: form.control, name: 'type' })
  const watchedCustomer = useWatch({ control: form.control, name: 'customer' })
  const watchedItems = useWatch({ control: form.control, name: 'line_items' })
  const watchedDocDiscount = useWatch({
    control: form.control,
    name: 'discount_percent',
  })
  const watchedCurrency = useWatch({ control: form.control, name: 'currency' })

  useEffect(() => {
    if (isEditing || hydrated) return
    form.setValue('document_number', generateDocumentNumber(watchedType, settings))
  }, [watchedType, settings, form, isEditing, hydrated])

  useEffect(() => {
    if (isEditing || !settings || hydrated) return
    form.setValue('currency', normalizeCurrencyCode(settings.currency || currency))
    form.setValue('tax_percent', settings.default_tax_rate ?? 0)
  }, [settings, currency, form, isEditing, hydrated])

  useEffect(() => {
    if (!isEditing || !existingDoc || itemsLoading || hydrated) return

    if (existingDoc.status === 'converted' || existingDoc.status === 'cancelled') {
      toast.error('Converted or cancelled documents cannot be edited')
      navigate(`/documents/${existingDoc.id}`, { replace: true })
      return
    }

    const items = (existingItemsData?.items ?? []) as DocumentItem[]
    form.reset({
      document_number: existingDoc.document_number,
      type: existingDoc.type,
      status: existingDoc.status || 'draft',
      customer: existingDoc.customer || '',
      issue_date: existingDoc.issue_date?.slice(0, 10) || today,
      due_date: existingDoc.due_date?.slice(0, 10) || '',
      currency: normalizeCurrencyCode(
        existingDoc.currency || settings?.currency || currency,
      ),
      discount_percent: existingDoc.discount_percent || 0,
      tax_percent: existingDoc.tax_percent || 0,
      billing_address: stripHtml(existingDoc.billing_address) || '',
      reference: existingDoc.reference || '',
      notes: stripHtml(existingDoc.notes) || '',
      line_items:
        items.length > 0
          ? items.map((item) => ({
              product: item.product || '',
              description: item.description,
              part_number: item.part_number || '',
              hsn_code: item.hsn_code || '',
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_percent: item.discount_percent || 0,
              tax_percent: item.tax_percent || 0,
              save_as_product: false,
            }))
          : [emptyLine(defaultTax)],
    })
    setHydrated(true)
  }, [
    isEditing,
    existingDoc,
    existingItemsData?.items,
    itemsLoading,
    hydrated,
    form,
    navigate,
    today,
    settings,
    currency,
    defaultTax,
  ])

  useEffect(() => {
    if (isEditing) return
    const customer = (customersData?.items ?? []).find((c) => c.id === watchedCustomer)
    if (customer?.address) {
      form.setValue('billing_address', customer.address)
    }
  }, [watchedCustomer, customersData?.items, form, isEditing])

  const totals = useMemo(
    () => calcDocumentTotals(watchedItems ?? [], watchedDocDiscount ?? 0),
    [watchedItems, watchedDocDiscount],
  )

  const customers = customersData?.items ?? []
  const products = productsData?.items ?? []
  const isSubmitting = form.formState.isSubmitting
  const displayCurrency = resolveDocumentCurrency(
    watchedCurrency,
    settings,
    currency,
  )

  const onProductSelect = (index: number, productId: string) => {
    form.setValue(`line_items.${index}.product`, productId)
    const product = products.find((p: Product) => p.id === productId)
    if (!product) return
    form.setValue(`line_items.${index}.description`, product.name)
    form.setValue(
      `line_items.${index}.part_number`,
      product.sku || product.manufacturer_code || product.model || '',
    )
    form.setValue(`line_items.${index}.unit_price`, product.unit_cost || 0)
    form.setValue(`line_items.${index}.save_as_product`, false)
  }

  const onSubmit = async (values: SalesDocumentFormValues) => {
    try {
      const { line_items, ...docData } = values
      const lineTotals = line_items.map((item) => ({
        ...item,
        ...calcLineTotals(item),
      }))
      const docTotals = calcDocumentTotals(line_items, values.discount_percent)

      const payload = {
        document_number: docData.document_number,
        type: docData.type,
        status: docData.status,
        customer: docData.customer,
        issue_date: docData.issue_date,
        due_date: docData.due_date || '',
        currency: normalizeCurrencyCode(
          docData.currency || settings?.currency || currency,
        ),
        discount_percent: docData.discount_percent || 0,
        tax_percent: docData.tax_percent || 0,
        subtotal: docTotals.subtotal,
        discount_amount: docTotals.discountAmount,
        tax_amount: docTotals.taxAmount,
        total: docTotals.total,
        billing_address: docData.billing_address || '',
        reference: docData.reference || '',
        notes: docData.notes || '',
      }

      let docId = editId

      if (isEditing && editId) {
        await updateRecord(COLLECTIONS.DOCUMENTS, editId, payload)

        const currentItems = existingItemsData?.items ?? []
        for (const item of currentItems) {
          await deleteRecord(COLLECTIONS.DOCUMENT_ITEMS, item.id)
        }
      } else {
        const created = await createRecord(COLLECTIONS.DOCUMENTS, payload)
        docId = created.id
      }

      if (!docId) throw new Error('Document id missing')

      for (const item of lineTotals) {
        let productId = item.product || ''

        if (!productId && item.save_as_product && item.description) {
          const created = await createRecord(COLLECTIONS.PRODUCTS, {
            asset_tag: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: item.description,
            description: item.description,
            sku: item.part_number || '',
            manufacturer_code: item.part_number || '',
            model: '',
            unit_of_measure: 'each',
            status: 'in_stock',
            unit_cost: item.unit_price || 0,
            tags: [],
          })
          productId = created.id
        }

        await createRecord(COLLECTIONS.DOCUMENT_ITEMS, {
          document: docId,
          product: productId,
          description: item.description,
          part_number: item.part_number || '',
          hsn_code: item.hsn_code || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          tax_percent: item.tax_percent || 0,
          line_total: item.lineTotal,
        })
      }

      toast.success(
        isEditing
          ? 'Document updated'
          : `${DOCUMENT_TYPES.find((t) => t.value === values.type)?.label} created`,
      )
      navigate(`/documents/${docId}`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isEditing
            ? 'Failed to update document'
            : 'Failed to create document',
      )
    }
  }

  if (isEditing && (docLoading || itemsLoading || !hydrated)) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? 'Edit Document' : 'New Document'}
        description={
          isEditing
            ? `Update ${existingDoc?.document_number || 'document'} details and line items.`
            : 'Create a quotation, invoice, or proforma invoice.'
        }
        breadcrumbs={[
          { label: 'Documents', href: '/documents' },
          ...(isEditing && existingDoc
            ? [
                {
                  label: existingDoc.document_number,
                  href: `/documents/${existingDoc.id}`,
                },
                { label: 'Edit' },
              ]
            : [{ label: 'New' }]),
        ]}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isEditing}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="document_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Auto-generated from settings prefixes; editable.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer: Customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="issue_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due / Valid Until</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input placeholder="PO / enquiry ref" {...field} />
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
                      value={normalizeCurrencyCode(field.value || currency)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[
                          'INR',
                          'USD',
                          'EUR',
                          'GBP',
                          'AED',
                          'SAR',
                          'AUD',
                          'CAD',
                          'JPY',
                        ].map((code) => (
                          <SelectItem key={code} value={code}>
                            {code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Defaults to the currency from Settings ({currency}).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discount_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Discount %</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="100" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billing_address"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Billing Address</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-3">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append(emptyLine(defaultTax))}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {fields.map((field, index) => {
                const line = watchedItems?.[index]
                const lineCalc = line ? calcLineTotals(line) : null
                const isCustom = !line?.product

                return (
                  <div
                    key={field.id}
                    className="space-y-3 rounded-lg border p-4"
                  >
                    <div className="grid gap-3 lg:grid-cols-2">
                      <FormField
                        control={form.control}
                        name={`line_items.${index}.product`}
                        render={({ field: productField }) => (
                          <FormItem>
                            <FormLabel>Product</FormLabel>
                            <FormControl>
                              <ProductPicker
                                products={products}
                                value={productField.value}
                                onSelect={(productId) => onProductSelect(index, productId)}
                                onClear={() => {
                                  form.setValue(`line_items.${index}.product`, '')
                                  form.setValue(`line_items.${index}.save_as_product`, false)
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              Pick from catalog, or leave empty for a custom line.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`line_items.${index}.description`}
                        render={({ field: descField }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input {...descField} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                      <FormField
                        control={form.control}
                        name={`line_items.${index}.part_number`}
                        render={({ field: partField }) => (
                          <FormItem>
                            <FormLabel>Part No.</FormLabel>
                            <FormControl>
                              <Input {...partField} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`line_items.${index}.hsn_code`}
                        render={({ field: hsnField }) => (
                          <FormItem>
                            <FormLabel>HSN</FormLabel>
                            <FormControl>
                              <Input {...hsnField} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`line_items.${index}.quantity`}
                        render={({ field: qtyField }) => (
                          <FormItem>
                            <FormLabel>Qty</FormLabel>
                            <FormControl>
                              <Input type="number" min="0.01" step="0.01" {...qtyField} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`line_items.${index}.unit_price`}
                        render={({ field: priceField }) => (
                          <FormItem>
                            <FormLabel>Unit Price</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" step="0.01" {...priceField} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`line_items.${index}.discount_percent`}
                        render={({ field: discField }) => (
                          <FormItem>
                            <FormLabel>Disc %</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" max="100" step="0.01" {...discField} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`line_items.${index}.tax_percent`}
                        render={({ field: taxField }) => (
                          <FormItem>
                            <FormLabel>Tax %</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" max="100" step="0.01" {...taxField} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-muted-foreground">
                        Line total:{' '}
                        <span className="font-medium text-foreground">
                          {lineCalc
                            ? formatCurrency(lineCalc.lineTotal, displayCurrency)
                            : formatCurrency(0, displayCurrency)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        {isCustom && (
                          <FormField
                            control={form.control}
                            name={`line_items.${index}.save_as_product`}
                            render={({ field: saveField }) => (
                              <FormItem className="flex flex-row items-center gap-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={saveField.value ?? false}
                                    onCheckedChange={(checked) =>
                                      saveField.onChange(checked === true)
                                    }
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Add to products catalog
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={fields.length === 1}
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}

              <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(totals.subtotal, displayCurrency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>{formatCurrency(totals.discountAmount, displayCurrency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(totals.taxAmount, displayCurrency)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(totals.total, displayCurrency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" asChild>
              <Link to={isEditing && editId ? `/documents/${editId}` : '/documents'}>
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Document'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
