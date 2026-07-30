import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Textarea } from '@/components/ui/textarea'
import { useTypedCollectionQuery } from '@/hooks/use-collection'
import { COLLECTIONS } from '@/lib/pocketbase'
import { createRecord } from '@/services/crud'
import { purchaseOrderSchema } from '@/schemas'
import type { Product, Supplier } from '@/types'

const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  unit_cost: z.coerce.number().min(0, 'Unit cost must be non-negative'),
  product: z.string().optional(),
})

const poFormSchema = purchaseOrderSchema.extend({
  line_items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
})

type PoFormValues = z.infer<typeof poFormSchema>

function generatePoNumber(): string {
  return `PO-${Date.now()}`
}

export default function PurchaseOrderFormPage() {
  const navigate = useNavigate()
  const today = new Date().toISOString().slice(0, 10)

  const { data: suppliersData } = useTypedCollectionQuery('suppliers', {
    perPage: 200,
    sort: 'name',
  })
  const { data: productsData } = useTypedCollectionQuery('products', {
    perPage: 500,
    sort: 'name',
  })

  const form = useForm<PoFormValues>({
    resolver: zodResolver(poFormSchema),
    defaultValues: {
      po_number: generatePoNumber(),
      supplier: '',
      purchase_date: today,
      expected_date: '',
      status: 'draft',
      notes: '',
      line_items: [{ description: '', quantity: 1, unit_cost: 0, product: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'line_items',
  })

  const onSubmit = async (values: PoFormValues) => {
    try {
      const { line_items, ...poData } = values
      const po = await createRecord(COLLECTIONS.PURCHASE_ORDERS, {
        ...poData,
        expected_date: poData.expected_date || '',
        notes: poData.notes ?? '',
      })

      for (const item of line_items) {
        await createRecord(COLLECTIONS.PURCHASE_ORDER_ITEMS, {
          purchase_order: po.id,
          description: item.description,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          received_quantity: 0,
          product: item.product || '',
        })
      }

      toast.success('Purchase order created')
      navigate(`/purchase-orders/${po.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create purchase order')
    }
  }

  const suppliers = suppliersData?.items ?? []
  const products = productsData?.items ?? []
  const isSubmitting = form.formState.isSubmitting

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Purchase Order"
        breadcrumbs={[
          { label: 'Purchase Orders', href: '/purchase-orders' },
          { label: 'New' },
        ]}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="po_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PO Number</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((supplier: Supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
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
                name="purchase_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expected_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
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
                onClick={() =>
                  append({ description: '', quantity: 1, unit_cost: 0, product: '' })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-5"
                >
                  <FormField
                    control={form.control}
                    name={`line_items.${index}.description`}
                    render={({ field: itemField }) => (
                      <FormItem className="lg:col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input {...itemField} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`line_items.${index}.quantity`}
                    render={({ field: itemField }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...itemField} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`line_items.${index}.unit_cost`}
                    render={({ field: itemField }) => (
                      <FormItem>
                        <FormLabel>Unit Cost</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step="0.01" {...itemField} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`line_items.${index}.product`}
                    render={({ field: itemField }) => (
                      <FormItem>
                        <FormLabel>Product (optional)</FormLabel>
                        <Select
                          onValueChange={(v) =>
                            itemField.onChange(v === '__none__' ? '' : v)
                          }
                          value={itemField.value || '__none__'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="None" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {products.map((product: Product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {fields.length > 1 && (
                    <div className="flex items-end lg:col-span-5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Purchase Order
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/purchase-orders">Cancel</Link>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
