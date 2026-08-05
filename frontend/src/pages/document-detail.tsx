import { type ColumnDef } from '@tanstack/react-table'
import {
  ArrowLeft,
  ArrowRightLeft,
  Copy,
  Loader2,
  Mail,
  Pencil,
  Printer,
  Share2,
} from 'lucide-react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { logAudit, getAuditChanges } from '@/services/audit'
import { updateRecord } from '@/services/crud'
import {
  conversionActionLabel,
  convertDocument,
  getConversionTarget,
} from '@/services/documents'
import type {
  AuditLogWithExpand,
  DocumentItemWithExpand,
  DocumentStatus,
  SalesDocument,
  SalesDocumentWithExpand,
} from '@/types'
import { DOCUMENT_STATUSES, getLabel, DOCUMENT_TYPES } from '@/utils/constants'
import {
  createShareToken,
  formatAddressBlock,
  getDocumentTypeLabel,
  resolveDocumentCurrency,
  splitGstAmount,
  stripHtml,
} from '@/utils/documents'
import { printDocument } from '@/utils/print-document'

function getShareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`
}

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const writable = canWrite()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)

  const { data: doc, isLoading: docLoading, refetch } =
    useRecord<SalesDocumentWithExpand>(
      COLLECTIONS.DOCUMENTS,
      id,
      'customer,source_document,converted_to',
      { staleTime: 0, refetchOnMount: 'always' },
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

  const auditOptions = useMemo(
    () => ({
      perPage: 200,
      filter: id ? `collection_name = "documents" && record_id = "${id}"` : undefined,
      expand: 'user',
      sort: '-created',
    }),
    [id],
  )

  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } =
    useTypedCollectionQuery('audit_logs', auditOptions)

  const items = itemsData?.items ?? []
  const auditLogs = (auditData?.items ?? []) as AuditLogWithExpand[]
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

  const isQuotation = doc?.type === 'quotation'
  const gst = splitGstAmount(doc?.tax_amount || 0, doc?.gst_type)
  const discountPercent = Number(doc?.discount_percent) || 0
  const discountAmount =
    discountPercent > 0
      ? Number(doc?.discount_amount) || 0
      : 0
  // Prefer live DB totals; if % was cleared, don't keep a stale discounted total.
  const taxable = (doc?.subtotal || 0) - discountAmount
  const displayTotal =
    discountPercent > 0
      ? Number(doc?.total) || 0
      : (doc?.subtotal || 0) + (isQuotation ? 0 : Number(doc?.tax_amount) || 0)
  const billingBlock = formatAddressBlock({
    address: doc?.billing_address || doc?.expand?.customer?.address,
    state: doc?.billing_state || doc?.expand?.customer?.state,
    pincode: doc?.billing_pincode || doc?.expand?.customer?.pincode,
  })

  const columns: ColumnDef<DocumentItemWithExpand>[] = useMemo(() => {
    const hasLineDiscount = items.some((item) => (item.discount_percent || 0) > 0)
    const cols: ColumnDef<DocumentItemWithExpand>[] = [
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
    ]

    if (hasLineDiscount) {
      cols.push({
        accessorKey: 'discount_percent',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Disc %" />
        ),
        cell: ({ row }) => `${row.original.discount_percent || 0}%`,
      })
    }

    cols.push({
      accessorKey: 'line_total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: ({ row }) => formatCurrency(row.original.line_total || 0, currency),
    })

    return cols
  }, [items, currency])

  const ensureShareToken = async (current: SalesDocument): Promise<string> => {
    if (current.share_token) return current.share_token
    const token = createShareToken()
    await updateRecord(COLLECTIONS.DOCUMENTS, current.id, {
      share_token: token,
    })
    await logAudit({
      action: 'update',
      collection: COLLECTIONS.DOCUMENTS,
      recordId: current.id,
      previousValue: { share_token: '' },
      newValue: {
        share_token: token,
        document_number: current.document_number,
      },
    })
    await refetch()
    await refetchAudit()
    return token
  }

  const handleStatusChange = async (status: DocumentStatus) => {
    if (!id || !doc) return
    setIsUpdating(true)
    try {
      const previous = doc.status
      await updateRecord(COLLECTIONS.DOCUMENTS, id, { status })
      await logAudit({
        action: 'update',
        collection: COLLECTIONS.DOCUMENTS,
        recordId: id,
        previousValue: { status: previous, document_number: doc.document_number },
        newValue: { status, document_number: doc.document_number },
      })
      toast.success('Status updated')
      await refetch()
      await refetchAudit()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handlePrint = () => {
    if (!doc) return
    try {
      printDocument({
        document: doc,
        items,
        customer: doc.expand?.customer,
        settings,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to print')
    }
  }

  const handleCopyShareLink = async () => {
    if (!doc) return
    try {
      const token = await ensureShareToken(doc)
      const url = getShareUrl(token)
      await navigator.clipboard.writeText(url)
      toast.success('Share link copied')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to copy link')
    }
  }

  const handleEmailShare = async () => {
    if (!doc) return
    try {
      const token = await ensureShareToken(doc)
      const url = getShareUrl(token)
      const typeLabel = getDocumentTypeLabel(doc.type)
      const subject = encodeURIComponent(
        `${typeLabel} ${doc.document_number}`,
      )
      const body = encodeURIComponent(
        `Please find your ${typeLabel.toLowerCase()} ${doc.document_number}.\n\nView online: ${url}`,
      )
      const to = doc.expand?.customer?.email || ''
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open email')
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
        actions={
          <>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void handleCopyShareLink()}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy web link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleEmailShare()}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email customer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={itemsLoading}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </>
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
              {writable && doc.status !== 'converted' ? (
                <Select
                  value={doc.status}
                  onValueChange={(value) =>
                    handleStatusChange(value as DocumentStatus)
                  }
                  disabled={isUpdating}
                >
                  <SelectTrigger className="mt-1 h-8 w-[150px]">
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
              ) : (
                <div className="mt-1">
                  <StatusBadge status={doc.status} type="document" />
                </div>
              )}
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
            {billingBlock && (
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">Billing Address</p>
                <p className="whitespace-pre-wrap font-medium">{billingBlock}</p>
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
            {discountPercent > 0 ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Discount ({discountPercent}%)
                </span>
                <span>{formatCurrency(discountAmount, currency)}</span>
              </div>
            ) : null}
            {!isQuotation && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxable</span>
                  <span>{formatCurrency(taxable, currency)}</span>
                </div>
                {gst.gstType === 'igst' ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      IGST ({doc.tax_percent || 0}%)
                    </span>
                    <span>{formatCurrency(gst.igst, currency)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        CGST ({(doc.tax_percent || 0) / 2}%)
                      </span>
                      <span>{formatCurrency(gst.cgst, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        SGST ({(doc.tax_percent || 0) / 2}%)
                      </span>
                      <span>{formatCurrency(gst.sgst, currency)}</span>
                    </div>
                  </>
                )}
              </>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(displayTotal, currency)}</span>
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

      <Card>
        <CardHeader>
          <CardTitle>Audit trail</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No audit events yet. Create, update, status, share, and convert
              actions will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Action</th>
                    <th className="py-2 pr-3 font-medium">User</th>
                    <th className="py-2 font-medium">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((entry) => {
                    const changes = getAuditChanges(
                      entry.previous_value,
                      entry.new_value,
                    )
                    return (
                      <tr key={entry.id} className="border-b last:border-0">
                        <td className="whitespace-nowrap py-2 pr-3 align-top">
                          {formatDate(entry.created)}
                        </td>
                        <td className="py-2 pr-3 align-top capitalize">
                          {entry.action}
                        </td>
                        <td className="py-2 pr-3 align-top">
                          {entry.expand?.user?.name ||
                            entry.expand?.user?.email ||
                            'System'}
                        </td>
                        <td className="max-w-lg py-2 align-top">
                          {changes.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <ul className="space-y-1 text-sm">
                              {changes.map((change) => (
                                <li key={change.field}>
                                  <span className="font-medium text-foreground">
                                    {change.field}
                                  </span>
                                  <span className="text-muted-foreground">
                                    : {change.from}
                                  </span>
                                  <span className="mx-1 text-muted-foreground">
                                    →
                                  </span>
                                  <span className="text-foreground">
                                    {change.to}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
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
