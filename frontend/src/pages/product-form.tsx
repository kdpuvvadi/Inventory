import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { RecordModel } from 'pocketbase'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useTypedCollectionQuery } from '@/hooks/use-collection'
import { COLLECTIONS } from '@/lib/pocketbase'
import { productSchema } from '@/schemas'
import { logAudit } from '@/services/audit'
import { createRecord, updateRecord } from '@/services/crud'
import type { Product } from '@/types'
import { generateAssetTag, generateBarcodeValue } from '@/utils/barcode'
import { PRODUCT_STATUSES, UNIT_OF_MEASURES } from '@/utils/constants'

const productFormSchema = productSchema.extend({
  tags: z.array(z.string()),
})

type ProductFormValues = z.infer<typeof productFormSchema>

function buildCreateDefaults(): ProductFormValues {
  const assetTag = generateAssetTag()
  return {
    asset_tag: assetTag,
    name: '',
    description: '',
    model: '',
    manufacturer: '',
    supplier: '',
    manufacturer_code: '',
    sku: '',
    serial_number: '',
    lot_number: '',
    purchase_date: '',
    received_date: '',
    unit_of_measure: 'each',
    barcode: generateBarcodeValue(assetTag),
    qr_code: assetTag,
    category: '',
    sub_category: '',
    tags: [],
    status: 'in_stock',
    unit_cost: 0,
    track_serials: false,
  }
}

function productToFormValues(product: Product): ProductFormValues {
  return {
    asset_tag: product.asset_tag ?? '',
    name: product.name ?? '',
    description: product.description ?? '',
    model: product.model ?? '',
    manufacturer: product.manufacturer ?? '',
    supplier: product.supplier ?? '',
    manufacturer_code: product.manufacturer_code ?? '',
    sku: product.sku ?? '',
    serial_number: product.serial_number ?? '',
    lot_number: product.lot_number ?? '',
    purchase_date: product.purchase_date ?? '',
    received_date: product.received_date ?? '',
    unit_of_measure: product.unit_of_measure ?? 'each',
    barcode: product.barcode ?? '',
    qr_code: product.qr_code ?? '',
    category: product.category ?? '',
    sub_category: product.sub_category ?? '',
    tags: product.tags ?? [],
    status: product.status ?? 'in_stock',
    unit_cost: product.unit_cost ?? 0,
    track_serials: product.track_serials ?? false,
  }
}

interface RelationSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: { id: string; name: string }[]
  placeholder?: string
}

function RelationSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
}: RelationSelectProps) {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <Select
        value={value || 'none'}
        onValueChange={(next) => onChange(next === 'none' ? '' : next)}
      >
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )
}

interface ProductFormFieldsProps {
  form: UseFormReturn<ProductFormValues>
  isCreate?: boolean
}

export function ProductFormFields({ form, isCreate = false }: ProductFormFieldsProps) {
  const { data: manufacturers } = useTypedCollectionQuery('manufacturers', {
    sort: 'name',
    perPage: 200,
  })
  const { data: suppliers } = useTypedCollectionQuery('suppliers', {
    sort: 'name',
    perPage: 200,
  })
  const { data: categories } = useTypedCollectionQuery('categories', {
    sort: 'name',
    perPage: 200,
  })

  const categoryOptions = categories?.items ?? []
  const selectedCategory = form.watch('category')
  const subCategoryOptions = useMemo(
    () => categoryOptions.filter((cat) => cat.parent === selectedCategory),
    [categoryOptions, selectedCategory],
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="asset_tag"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Asset Tag</FormLabel>
              <FormControl>
                <Input
                  placeholder="AST-YYYYMMDD-0000"
                  readOnly={!isCreate}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sku"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SKU</FormLabel>
              <FormControl>
                <Input placeholder="SKU" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="Product name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea placeholder="Description" rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="model"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model</FormLabel>
              <FormControl>
                <Input placeholder="Model" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="manufacturer_code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Manufacturer Code</FormLabel>
              <FormControl>
                <Input placeholder="Mfr code" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="manufacturer"
          render={({ field }) => (
            <RelationSelect
              label="Manufacturer"
              value={field.value ?? ''}
              onChange={field.onChange}
              options={manufacturers?.items ?? []}
            />
          )}
        />
        <FormField
          control={form.control}
          name="supplier"
          render={({ field }) => (
            <RelationSelect
              label="Supplier"
              value={field.value ?? ''}
              onChange={field.onChange}
              options={suppliers?.items ?? []}
            />
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <RelationSelect
              label="Category"
              value={field.value ?? ''}
              onChange={(value) => {
                field.onChange(value)
                form.setValue('sub_category', '')
              }}
              options={categoryOptions.filter((cat) => !cat.parent)}
            />
          )}
        />
        <FormField
          control={form.control}
          name="sub_category"
          render={({ field }) => (
            <RelationSelect
              label="Sub-category"
              value={field.value ?? ''}
              onChange={field.onChange}
              options={subCategoryOptions}
              placeholder={
                selectedCategory ? 'Select sub-category' : 'Select category first'
              }
            />
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PRODUCT_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
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
          name="unit_of_measure"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unit of Measure</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {UNIT_OF_MEASURES.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="unit_cost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unit Cost</FormLabel>
              <FormControl>
                <Input type="number" min={0} step="0.01" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags</FormLabel>
              <FormControl>
                <Input
                  placeholder="comma, separated, tags"
                  value={Array.isArray(field.value) ? field.value.join(', ') : ''}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="track_serials"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel>Track serial numbers</FormLabel>
              <p className="text-sm text-muted-foreground">
                Each unit of stock has its own serial number.
              </p>
            </div>
            <FormControl>
              <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="serial_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Serial Number</FormLabel>
              <FormControl>
                <Input placeholder="Serial number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="lot_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lot Number</FormLabel>
              <FormControl>
                <Input placeholder="Lot number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
          name="received_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Received Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {!isCreate && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="barcode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Barcode</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="qr_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>QR Code Value</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  )
}

interface ProductEditDialogProps {
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (product: Product) => void
}

export function ProductEditDialog({
  product,
  open,
  onOpenChange,
  onSuccess,
}: ProductEditDialogProps) {
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: productToFormValues(product),
  })

  useEffect(() => {
    if (open) {
      form.reset(productToFormValues(product))
    }
  }, [open, product, form])

  const handleSave = async (values: ProductFormValues) => {
    setIsSaving(true)
    try {
      const updated = await updateRecord<Product & RecordModel>(
        COLLECTIONS.PRODUCTS,
        product.id,
        values,
      )
      await logAudit({
        action: 'update',
        collection: COLLECTIONS.PRODUCTS,
        recordId: updated.id,
        previousValue: product as unknown as Record<string, unknown>,
        newValue: updated as unknown as Record<string, unknown>,
      })
      toast.success('Product updated')
      onOpenChange(false)
      onSuccess?.(updated)
    } catch {
      toast.error('Failed to update product')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Update product details for {product.name}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <ProductFormFields form={form} />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function ProductFormPage() {
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: buildCreateDefaults(),
  })

  const handleSave = async (values: ProductFormValues) => {
    setIsSaving(true)
    try {
      const created = await createRecord<Product & RecordModel>(
        COLLECTIONS.PRODUCTS,
        values,
      )
      await logAudit({
        action: 'create',
        collection: COLLECTIONS.PRODUCTS,
        recordId: created.id,
        newValue: created as unknown as Record<string, unknown>,
      })
      toast.success('Product created')
      navigate(`/products/${created.id}`)
    } catch {
      toast.error('Failed to create product')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Product"
        description="Create a new product in the inventory system."
        breadcrumbs={[
          { label: 'Products', href: '/products' },
          { label: 'New Product' },
        ]}
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSave)}
          className="mx-auto max-w-3xl space-y-6 rounded-lg border p-6"
        >
          <ProductFormFields form={form} isCreate />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/products')}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Product
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
