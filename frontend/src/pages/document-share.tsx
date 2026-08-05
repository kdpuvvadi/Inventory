import { Loader2, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import pb from '@/lib/pocketbase'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { DocumentType, GstType } from '@/types'
import { getLabel, DOCUMENT_TYPES } from '@/utils/constants'
import {
  formatAddressBlock,
  getDocumentTypeLabel,
  resolveDocumentCurrency,
  splitGstAmount,
  stripHtml,
} from '@/utils/documents'

interface PublicSharePayload {
  document: {
    id: string
    document_number: string
    type: DocumentType
    status: string
    issue_date: string
    due_date: string
    currency: string
    discount_percent: number
    tax_percent: number
    subtotal: number
    discount_amount: number
    tax_amount: number
    total: number
    billing_address: string
    billing_state: string
    billing_pincode: string
    gst_type: GstType
    reference: string
    notes: string
  }
  items: Array<{
    id: string
    description: string
    part_number: string
    hsn_code: string
    quantity: number
    unit_price: number
    discount_percent: number
    line_total: number
  }>
  customer: {
    id: string
    name: string
    contact_person: string
    email: string
    phone: string
    address: string
    state: string
    pincode: string
  } | null
  settings: {
    company_name: string
    company_address: string
    company_state: string
    company_pincode: string
    company_email: string
    company_phone: string
    gst_number: string
    currency: string
    header_show_logo: boolean
    header_show_address: boolean
    header_show_email: boolean
    header_show_phone: boolean
    header_show_gst: boolean
    company_logo_url?: string | null
  } | null
}

function resolveApiBase(): string {
  const envUrl = import.meta.env.VITE_POCKETBASE_URL
  if (typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/$/, '')
  }
  return pb.baseURL.replace(/\/$/, '')
}

export default function DocumentSharePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicSharePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setError('Invalid share link')
      setLoading(false)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `${resolveApiBase()}/api/public/documents/${encodeURIComponent(token)}`,
        )
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            message?: string
          } | null
          throw new Error(body?.message || 'Document not found')
        }
        const payload = (await res.json()) as PublicSharePayload
        if (!cancelled) setData(payload)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load document')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  const currency = useMemo(() => {
    const code =
      data?.settings?.currency?.trim() ||
      data?.document.currency?.trim() ||
      'USD'
    return resolveDocumentCurrency(code, null, code)
  }, [data])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Document unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {error || 'This share link is invalid or has expired.'}
          </CardContent>
        </Card>
      </div>
    )
  }

  const { document: doc, items, customer, settings } = data
  const isQuotation = doc.type === 'quotation'
  const gst = splitGstAmount(doc.tax_amount || 0, doc.gst_type)
  const taxable = (doc.subtotal || 0) - (doc.discount_amount || 0)
  const typeLabel = getDocumentTypeLabel(doc.type)
  const hasLineDiscount = items.some((item) => (item.discount_percent || 0) > 0)
  const hasDocDiscount = (Number(doc.discount_percent) || 0) > 0
  const companyAddress = formatAddressBlock({
    address: settings?.company_address,
    state: settings?.company_state,
    pincode: settings?.company_pincode,
  })
  const billingAddress = formatAddressBlock({
    address: doc.billing_address || customer?.address,
    state: doc.billing_state || customer?.state,
    pincode: doc.billing_pincode || customer?.pincode,
  })

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl space-y-6 print:max-w-none">
        <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div>
            <p className="text-sm text-muted-foreground">
              {getLabel(DOCUMENT_TYPES, doc.type)}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {doc.document_number}
            </h1>
            <p className="text-sm text-muted-foreground">
              {settings?.company_name || 'Shared document'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{typeLabel} details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">Company</p>
              <p className="font-medium">{settings?.company_name || '—'}</p>
              {settings?.header_show_address !== false && companyAddress && (
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {companyAddress}
                </p>
              )}
              {settings?.header_show_email !== false && settings?.company_email && (
                <p className="text-muted-foreground">{settings.company_email}</p>
              )}
              {settings?.header_show_phone !== false && settings?.company_phone && (
                <p className="text-muted-foreground">{settings.company_phone}</p>
              )}
              {settings?.header_show_gst !== false && settings?.gst_number && (
                <p className="text-muted-foreground">GST: {settings.gst_number}</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Bill to</p>
              <p className="font-medium">{customer?.name || '—'}</p>
              {billingAddress && (
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {billingAddress}
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Issue date</p>
              <p className="font-medium">
                {doc.issue_date ? formatDate(doc.issue_date) : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Due / valid until</p>
              <p className="font-medium">
                {doc.due_date ? formatDate(doc.due_date) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Description</th>
                  <th className="py-2 pr-2 text-right">Qty</th>
                  <th className="py-2 pr-2 text-right">Unit</th>
                  {hasLineDiscount ? (
                    <th className="py-2 pr-2 text-right">Disc %</th>
                  ) : null}
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id || index} className="border-b last:border-0">
                    <td className="py-2 pr-2 align-top">{index + 1}</td>
                    <td className="py-2 pr-2 align-top">
                      <div className="font-medium">{item.description}</div>
                      {(item.part_number || item.hsn_code) && (
                        <div className="text-xs text-muted-foreground">
                          {item.part_number ? `Part: ${item.part_number}` : ''}
                          {item.part_number && item.hsn_code ? ' · ' : ''}
                          {item.hsn_code ? `HSN: ${item.hsn_code}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right align-top">{item.quantity}</td>
                    <td className="py-2 pr-2 text-right align-top">
                      {formatCurrency(item.unit_price || 0, currency)}
                    </td>
                    {hasLineDiscount ? (
                      <td className="py-2 pr-2 text-right align-top">
                        {item.discount_percent || 0}%
                      </td>
                    ) : null}
                    <td className="py-2 text-right align-top">
                      {formatCurrency(item.line_total || 0, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="ml-auto w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(doc.subtotal || 0, currency)}</span>
            </div>
            {hasDocDiscount ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Discount ({Number(doc.discount_percent) || 0}%)
                </span>
                <span>{formatCurrency(doc.discount_amount || 0, currency)}</span>
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
              <span>{formatCurrency(doc.total || 0, currency)}</span>
            </div>
          </CardContent>
        </Card>

        {doc.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm">
              {stripHtml(doc.notes)}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
