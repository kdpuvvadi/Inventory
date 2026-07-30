import { type ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useRecord, useTypedCollectionQuery } from '@/hooks/use-collection'
import { canWrite } from '@/lib/auth'
import { COLLECTIONS } from '@/lib/pocketbase'
import { useFormatMoney } from '@/contexts/settings-context'
import { formatDate } from '@/lib/utils'
import { updateRecord } from '@/services/crud'
import { receivePurchaseOrder } from '@/services/inventory'
import type {
  PurchaseOrderItemWithExpand,
  PurchaseOrderWithExpand,
} from '@/types'

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const formatMoney = useFormatMoney()
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const writable = canWrite()

  const { data: po, isLoading: poLoading, refetch: refetchPo } =
    useRecord<PurchaseOrderWithExpand>(COLLECTIONS.PURCHASE_ORDERS, id, 'supplier')

  const itemsOptions = useMemo(
    () => ({
      perPage: 100,
      filter: id ? `purchase_order = "${id}"` : undefined,
      expand: 'product',
      sort: 'created',
    }),
    [id],
  )

  const { data: itemsData, isLoading: itemsLoading, refetch: refetchItems } =
    useTypedCollectionQuery('purchase_order_items', itemsOptions)

  const items = itemsData?.items ?? []

  const allFullyReceived = items.length > 0 && items.every(
    (item) => item.received_quantity >= item.quantity,
  )

  const canReceive =
    writable &&
    po &&
    po.status !== 'cancelled' &&
    po.status !== 'received' &&
    items.some((item) => item.received_quantity < item.quantity && item.product)

  const openReceive = () => {
    const initial: Record<string, number> = {}
    for (const item of items) {
      if (item.product && item.received_quantity < item.quantity) {
        initial[item.id] = item.quantity - item.received_quantity
      }
    }
    setReceiveQtys(initial)
    setReceiveOpen(true)
  }

  const handleMarkOrdered = async () => {
    if (!id) return
    setIsSubmitting(true)
    try {
      await updateRecord(COLLECTIONS.PURCHASE_ORDERS, id, { status: 'ordered' })
      toast.success('Purchase order marked as ordered')
      await refetchPo()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReceive = async () => {
    if (!id) return
    setIsSubmitting(true)
    try {
      const receiveItems = Object.entries(receiveQtys)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity }))

      if (receiveItems.length === 0) {
        toast.error('Enter quantities to receive')
        return
      }

      await receivePurchaseOrder({ poId: id, items: receiveItems })
      toast.success('Items received successfully')
      setReceiveOpen(false)
      await refetchPo()
      await refetchItems()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to receive items')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!id) return
    setIsSubmitting(true)
    try {
      await updateRecord(COLLECTIONS.PURCHASE_ORDERS, id, { status: 'cancelled' })
      toast.success('Purchase order cancelled')
      setCancelOpen(false)
      await refetchPo()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = async () => {
    if (!id) return
    setIsSubmitting(true)
    try {
      await updateRecord(COLLECTIONS.PURCHASE_ORDERS, id, { status: 'received' })
      toast.success('Purchase order closed')
      setCloseOpen(false)
      await refetchPo()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to close')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!id) return
    setIsSubmitting(true)
    try {
      await updateRecord(COLLECTIONS.PURCHASE_ORDERS, id, { notes })
      toast.success('Notes saved')
      await refetchPo()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save notes')
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: ColumnDef<PurchaseOrderItemWithExpand>[] = [
    {
      id: 'description',
      accessorFn: (row) =>
        row.description || row.expand?.product?.name || '—',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
    },
    {
      id: 'product',
      accessorFn: (row) => row.expand?.product?.asset_tag ?? '—',
      header: 'Product',
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ordered" />
      ),
    },
    {
      accessorKey: 'received_quantity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Received" />
      ),
    },
    {
      accessorKey: 'unit_cost',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Unit Cost" />
      ),
      cell: ({ row }) => formatMoney(row.getValue('unit_cost') as number),
    },
    {
      id: 'line_total',
      header: 'Line Total',
      cell: ({ row }) =>
        formatMoney(row.original.quantity * row.original.unit_cost),
    },
  ]

  if (poLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!po) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/purchase-orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Purchase Orders
          </Link>
        </Button>
        <p className="text-muted-foreground">Purchase order not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={po.po_number}
        breadcrumbs={[
          { label: 'Purchase Orders', href: '/purchase-orders' },
          { label: po.po_number },
        ]}
        actions={
          writable ? (
            <div className="flex flex-wrap gap-2">
              {po.status === 'draft' && (
                <Button onClick={handleMarkOrdered} disabled={isSubmitting}>
                  Mark Ordered
                </Button>
              )}
              {canReceive && (
                <Button variant="secondary" onClick={openReceive}>
                  Receive Items
                </Button>
              )}
              {allFullyReceived && po.status !== 'received' && po.status !== 'cancelled' && (
                <Button onClick={() => setCloseOpen(true)}>Close PO</Button>
              )}
              {po.status !== 'cancelled' && po.status !== 'received' && (
                <Button
                  variant="destructive"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Order Information</CardTitle>
          <StatusBadge status={po.status} type="purchase_order" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Supplier</p>
            <p className="font-medium">{po.expand?.supplier?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Purchase Date</p>
            <p className="font-medium">
              {po.purchase_date ? formatDate(po.purchase_date) : '—'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expected Date</p>
            <p className="font-medium">
              {po.expected_date ? formatDate(po.expected_date) : '—'}
            </p>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-sm text-muted-foreground">Notes</p>
            {writable && po.status === 'draft' ? (
              <div className="mt-1 space-y-2">
                <Textarea
                  value={notes || po.notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Order notes..."
                />
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={isSubmitting}
                >
                  Save Notes
                </Button>
              </div>
            ) : (
              <p>{po.notes || '—'}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Line Items</h2>
        <DataTable columns={columns} data={items} isLoading={itemsLoading} />
      </div>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {items
              .filter(
                (item) =>
                  item.product && item.received_quantity < item.quantity,
              )
              .map((item) => {
                const remaining = item.quantity - item.received_quantity
                const label =
                  item.description ||
                  item.expand?.product?.name ||
                  item.product
                return (
                  <div key={item.id} className="space-y-1">
                    <Label htmlFor={`receive-${item.id}`}>
                      {label} (remaining: {remaining})
                    </Label>
                    <Input
                      id={`receive-${item.id}`}
                      type="number"
                      min={0}
                      max={remaining}
                      value={receiveQtys[item.id] ?? 0}
                      onChange={(e) =>
                        setReceiveQtys((prev) => ({
                          ...prev,
                          [item.id]: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                )
              })}
            {items.filter((i) => i.product).length === 0 && (
              <p className="text-sm text-muted-foreground">
                No line items with linked products can be received.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceive} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Receive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel Purchase Order"
        description="Are you sure you want to cancel this purchase order?"
        confirmLabel="Cancel PO"
        destructive
        onConfirm={handleCancel}
        loading={isSubmitting}
      />

      <ConfirmDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title="Close Purchase Order"
        description="Mark this purchase order as fully received and closed?"
        confirmLabel="Close PO"
        onConfirm={handleClose}
        loading={isSubmitting}
      />
    </div>
  )
}
