import { type ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, ArrowRightLeft, Download, Loader2, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { PageHeader } from '@/components/layout/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSettings } from '@/contexts/settings-context'
import { useRecord, useTypedCollectionQuery } from '@/hooks/use-collection'
import { canWrite } from '@/lib/auth'
import { COLLECTIONS } from '@/lib/pocketbase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { updateRecord } from '@/services/crud'
import {
  conversionActionLabel,
  convertDocument,
  getConversionTarget,
} from '@/services/documents'
import type {
  DocumentItemWithExpand,
  DocumentStatus,
  SalesDocumentWithExpand,
} from '@/types'
import { DOCUMENT_STATUSES, getLabel, DOCUMENT_TYPES } from '@/utils/constants'
import { getDocumentTypeLabel, resolveDocumentCurrency, stripHtml } from '@/utils/documents'
import { exportDocumentPdf } from '@/utils/export-document-pdf'

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { settings, logoUrl } = useSettings()
  const writable = canWrite()
  const [isExporting, setIsExporting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)

  const { data: doc, isLoading: docLoading, refetch } =
    useRecord<SalesDocumentWithExpand>(
      COLLECTIONS.DOCUMENTS,
      id,
      'customer,source_document,converted_to',
    )

  const itemsOptions = useMemo(
    () => ({
      perPage: 200,
      filter: id ? `document = "${id}"` : undefined,
      expand: 'product',
      sort: 'created',
    }),
    [id],
  )

  const { data: itemsData, isLoading: itemsLoading } =
    useTypedCollectionQuery('document_items', itemsOptions)

  const items = itemsData?.items ?? []
  const currency = resolveDocumentCurrency(doc?.currency, settings)
  const conversionTarget = doc ? getConversionTarget(doc.type) : null
  const canConvert =
    writable &&
    doc &&
    conversionTarget &&
    doc.status !== 'cancelled' &&
    doc.status !== 'converted' &&
    !doc.converted_to

  const canEdit =
    writable &&
    doc &&
    doc.status !== 'cancelled' &&
    doc.status !== 'converted'

  const columns: ColumnDef<DocumentItemWithExpand>[] = [
    {
      id: 'product',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Product" />
      ),
      cell: ({ row }) => row.original.expand?.product?.name || '—',
    },
    {
      accessorKey: 'description',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.description}</div>
          {(row.original.part_number || row.original.hsn_code) && (
            <div className="text-xs text-muted-foreground">
              {row.original.part_number ? `Part: ${row.original.part_number}` : ''}
              {row.original.part_number && row.original.hsn_code ? ' · ' : ''}
              {row.original.hsn_code ? `HSN: ${row.original.hsn_code}` : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'quantity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Qty" />
      ),
    },
    {
      accessorKey: 'unit_price',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Unit Price" />
      ),
      cell: ({ row }) => formatCurrency(row.original.unit_price || 0, currency),
    },
    {
      accessorKey: 'discount_percent',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Disc %" />
      ),
      cell: ({ row }) => `${row.original.discount_percent || 0}%`,
    },
    {
      accessorKey: 'tax_percent',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tax %" />
      ),
      cell: ({ row }) => `${row.original.tax_percent || 0}%`,
    },
    {
      accessorKey: 'line_total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row }) => formatCurrency(row.original.line_total || 0, currency),
    },
  ]

  const handleStatusChange = async (status: DocumentStatus) => {
    if (!id) return
    setIsUpdating(true)
    try {
      await updateRecord(COLLECTIONS.DOCUMENTS, id, { status })
      toast.success('Status updated')
      await refetch()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleExportPdf = async () => {
    if (!doc) return
    setIsExporting(true)
    try {
      await exportDocumentPdf({
        document: doc,
        items,
        customer: doc.expand?.customer,
        settings,
        logoUrl,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export PDF')
    } finally {
      setIsExporting(false)
    }
  }

  const handleConvert = async () => {
    if (!doc || !conversionTarget) return
    setIsConverting(true)
    try {
      const created = await convertDocument({ source: doc, settings })
      toast.success(
        `Created ${getDocumentTypeLabel(conversionTarget)} ${created.document_number}. Original kept as converted.`,
      )
      setConvertOpen(false)
      navigate(`/documents/${created.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Conversion failed')
    } finally {
      setIsConverting(false)
    }
  }

  if (docLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="space-y-4">
        <PageHeader title="Document not found" />
        <Button variant="outline" asChild>
          <Link to="/documents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to documents
          </Link>
        </Button>
      </div>
    )
  }

  const convertLabel = conversionActionLabel(doc.type)

  return (
    <div className="space-y-6">
      <PageHeader
        title={doc.document_number}
        description={getLabel(DOCUMENT_TYPES, doc.type)}
        breadcrumbs={[
          { label: 'Documents', href: '/documents' },
          { label: doc.document_number },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/documents">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            {canEdit && (
              <Button variant="outline" asChild>
                <Link to={`/documents/${doc.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
            )}
            {canConvert && convertLabel && (
              <Button variant="secondary" onClick={() => setConvertOpen(true)}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                {convertLabel}
              </Button>
            )}
            <Button onClick={handleExportPdf} disabled={isExporting || itemsLoading}>
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export PDF
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{doc.expand?.customer?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-1 flex items-center gap-3">
                <StatusBadge status={doc.status} type="document" />
                {writable && doc.status !== 'converted' && (
                  <Select
                    value={doc.status}
                    onValueChange={(value) =>
                      handleStatusChange(value as DocumentStatus)
                    }
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="h-8 w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_STATUSES.filter((s) => s.value !== 'converted').map(
                        (status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Issue Date</p>
              <p className="font-medium">
                {doc.issue_date ? formatDate(doc.issue_date) : '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due / Valid Until</p>
              <p className="font-medium">
                {doc.due_date ? formatDate(doc.due_date) : '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reference</p>
              <p className="font-medium">{doc.reference || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Currency</p>
              <p className="font-medium">{currency}</p>
            </div>
            {doc.expand?.source_document && (
              <div>
                <p className="text-sm text-muted-foreground">Converted from</p>
                <Link
                  to={`/documents/${doc.expand.source_document.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {doc.expand.source_document.document_number}
                </Link>
              </div>
            )}
            {(doc.expand?.converted_to || doc.converted_to) && (
              <div>
                <p className="text-sm text-muted-foreground">Converted to</p>
                <Link
                  to={`/documents/${doc.expand?.converted_to?.id || doc.converted_to}`}
                  className="font-medium text-primary hover:underline"
                >
                  {doc.expand?.converted_to?.document_number || 'View document'}
                </Link>
              </div>
            )}
            {(doc.billing_address || doc.expand?.customer?.address) && (
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">Billing Address</p>
                <p className="whitespace-pre-wrap font-medium">
                  {stripHtml(doc.billing_address) ||
                    doc.expand?.customer?.address}
                </p>
              </div>
            )}
            {doc.notes && (
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="whitespace-pre-wrap font-medium">
                  {stripHtml(doc.notes)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(doc.subtotal || 0, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>{formatCurrency(doc.discount_amount || 0, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(doc.tax_amount || 0, currency)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(doc.total || 0, currency)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={items}
            isLoading={itemsLoading}
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        title={convertLabel || 'Convert document'}
        description={
          conversionTarget
            ? `This creates a new ${getDocumentTypeLabel(conversionTarget)} with the same line items and keeps ${doc.document_number} as a converted record.`
            : ''
        }
        confirmLabel={isConverting ? 'Converting…' : 'Convert'}
        onConfirm={() => {
          void handleConvert()
        }}
        loading={isConverting}
      />
    </div>
  )
}
