import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/page-header'
import { SerialNumbersInput } from '@/components/serial-numbers-input'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useTypedCollectionQuery } from '@/hooks/use-collection'
import { ingestOpeningStock } from '@/services/inventory'
import { parseSerialList } from '@/services/serials'
import type { Product, Warehouse } from '@/types'
import { generateAssetTag } from '@/utils/barcode'
import { PRODUCT_STATUSES, UNIT_OF_MEASURES } from '@/utils/constants'

const baseIntakeFields = {
  warehouseId: z.string().min(1, 'Warehouse is required'),
  location: z.string().optional(),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  min_stock: z.coerce.number().min(0).optional(),
  max_stock: z.coerce.number().min(0).optional(),
  reorder_level: z.coerce.number().min(0).optional(),
  reason: z.string().min(1, 'Reason is required'),
  remarks: z.string().optional(),
}

const existingProductSchema = z.object({
  mode: z.literal('existing'),
  productId: z.string().min(1, 'Product is required'),
  unit_cost: z.coerce.number().min(0).optional(),
  ...baseIntakeFields,
})

const newProductSchema = z.object({
  mode: z.literal('new'),
  asset_tag: z.string().min(1, 'Asset tag is required'),
  name: z.string().min(1, 'Name is required'),
  manufacturer: z.string().optional(),
  supplier: z.string().optional(),
  category: z.string().optional(),
  sku: z.string().optional(),
  serial_number: z.string().optional(),
  unit_of_measure: z.string().min(1, 'Unit of measure is required'),
  unit_cost: z.coerce.number().min(0).optional(),
  status: z.enum([
    'in_stock',
    'reserved',
    'assigned',
    'installed',
    'damaged',
    'scrap',
    'sold',
    'returned',
  ]),
  track_serials: z.boolean().optional(),
  ...baseIntakeFields,
})

const stockIntakeSchema = z.discriminatedUnion('mode', [
  existingProductSchema,
  newProductSchema,
])

type StockIntakeFormValues = z.infer<typeof stockIntakeSchema>

function buildExistingDefaults(): StockIntakeFormValues {
  return {
    mode: 'existing',
    productId: '',
    warehouseId: '',
    location: '',
    quantity: 1,
    min_stock: undefined,
    max_stock: undefined,
    reorder_level: undefined,
    reason: 'Opening stock intake',
    remarks: '',
    unit_cost: undefined,
  }
}

function buildNewProductDefaults(): StockIntakeFormValues {
  const assetTag = generateAssetTag()
  return {
    mode: 'new',
    asset_tag: assetTag,
    name: '',
    manufacturer: '',
    supplier: '',
    category: '',
    sku: '',
    serial_number: '',
    unit_of_measure: 'each',
    unit_cost: 0,
    status: 'in_stock',
    track_serials: false,
    warehouseId: '',
    location: '',
    quantity: 1,
    min_stock: undefined,
    max_stock: undefined,
    reorder_level: undefined,
    reason: 'Opening stock intake',
    remarks: '',
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

export default function StockIntakePage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [productSearch, setProductSearch] = useState('')
  const [serialsText, setSerialsText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<StockIntakeFormValues>({
    resolver: zodResolver(stockIntakeSchema),
    defaultValues: buildExistingDefaults(),
  })

  const { data: productsData } = useTypedCollectionQuery('products', {
    perPage: 500,
    sort: 'name',
  })
  const { data: warehousesData } = useTypedCollectionQuery('warehouses', {
    perPage: 100,
    sort: 'name',
  })
  const { data: manufacturersData } = useTypedCollectionQuery('manufacturers', {
    sort: 'name',
    perPage: 200,
  })
  const { data: suppliersData } = useTypedCollectionQuery('suppliers', {
    sort: 'name',
    perPage: 200,
  })
  const { data: categoriesData } = useTypedCollectionQuery('categories', {
    sort: 'name',
    perPage: 200,
  })

  const products = productsData?.items ?? []
  const warehouses = warehousesData?.items ?? []
  const manufacturers = manufacturersData?.items ?? []
  const suppliers = suppliersData?.items ?? []
  const categories = categoriesData?.items ?? []

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase()
    if (!term) return products
    return products.filter(
      (product: Product) =>
        product.name.toLowerCase().includes(term) ||
        product.asset_tag.toLowerCase().includes(term) ||
        (product.sku && product.sku.toLowerCase().includes(term)),
    )
  }, [products, productSearch])

  const handleModeChange = (nextMode: string) => {
    const resolved = nextMode as 'existing' | 'new'
    setMode(resolved)
    setProductSearch('')
    setSerialsText('')
    form.reset(resolved === 'existing' ? buildExistingDefaults() : buildNewProductDefaults())
  }

  const selectedProductId =
    mode === 'existing' ? form.watch('productId') : undefined
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId],
  )
  const newTrackSerials = mode === 'new' ? form.watch('track_serials') : false
  const quantity = form.watch('quantity')
  const requiresSerials =
    mode === 'existing'
      ? Boolean(selectedProduct?.track_serials)
      : Boolean(newTrackSerials)

  const regenerateAssetTag = () => {
    if (form.getValues('mode') === 'new') {
      form.setValue('asset_tag', generateAssetTag())
    }
  }

  const handleSubmit = async (values: StockIntakeFormValues) => {
    const serials = requiresSerials ? parseSerialList(serialsText) : undefined
    if (requiresSerials) {
      if (serials!.length !== values.quantity) {
        toast.error(
          `Enter exactly ${values.quantity} serial number(s) for this intake`,
        )
        return
      }
    }

    setIsSubmitting(true)
    try {
      const common = {
        warehouseId: values.warehouseId,
        location: values.location,
        quantity: values.quantity,
        min_stock: values.min_stock,
        max_stock: values.max_stock,
        reorder_level: values.reorder_level,
        reason: values.reason,
        remarks: values.remarks,
        serials,
      }

      const result =
        values.mode === 'existing'
          ? await ingestOpeningStock({
              ...common,
              productId: values.productId,
              unit_cost: values.unit_cost,
            })
          : await ingestOpeningStock({
              ...common,
              unit_cost: values.unit_cost,
              track_serials: values.track_serials,
              product: {
                asset_tag: values.asset_tag,
                name: values.name,
                manufacturer: values.manufacturer,
                supplier: values.supplier,
                category: values.category,
                sku: values.sku,
                serial_number: values.serial_number,
                unit_of_measure: values.unit_of_measure,
                status: values.status,
                track_serials: values.track_serials,
              },
            })

      toast.success('Stock intake recorded successfully')
      navigate(`/products/${result.product.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to record stock intake')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Intake"
        description="Add existing stock without a purchase order."
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Stock Intake' },
        ]}
      />

      <Tabs value={mode} onValueChange={handleModeChange} className="mx-auto max-w-3xl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="existing">Existing product</TabsTrigger>
          <TabsTrigger value="new">New product</TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="mt-6 space-y-6 rounded-lg border p-6"
          >
            <TabsContent value="existing" className="mt-0 space-y-4">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <Input
                      placeholder="Search by name, asset tag, or SKU..."
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      className="mb-2"
                    />
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredProducts.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            No products match your search
                          </SelectItem>
                        ) : (
                          filteredProducts.map((product: Product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} ({product.asset_tag})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              {selectedProduct?.track_serials && (
                <p className="text-sm text-muted-foreground">
                  This product tracks serial numbers — enter one per unit below.
                </p>
              )}
            </TabsContent>

            <TabsContent value="new" className="mt-0 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="asset_tag"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Tag</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="AST-YYYYMMDD-0000" {...field} />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={regenerateAssetTag}
                          title="Regenerate asset tag"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
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

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="manufacturer"
                  render={({ field }) => (
                    <RelationSelect
                      label="Manufacturer"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={manufacturers}
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
                      options={suppliers}
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
                      onChange={field.onChange}
                      options={categories.filter((cat) => !cat.parent)}
                    />
                  )}
                />
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
            </TabsContent>

            <div className="space-y-4 border-t pt-4">
              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warehouse</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehouses.map((wh: Warehouse) => (
                          <SelectItem key={wh.id} value={wh.id}>
                            {wh.name}
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
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Shelf / bin location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {requiresSerials && (
                <SerialNumbersInput
                  value={serialsText}
                  onChange={setSerialsText}
                  expectedQuantity={quantity ?? 1}
                />
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="min_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Stock</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="max_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Stock</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reorder_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Level</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Input placeholder="Reason for intake" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional remarks" rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/inventory')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Stock Intake
              </Button>
            </div>
          </form>
        </Form>
      </Tabs>
    </div>
  )
}
