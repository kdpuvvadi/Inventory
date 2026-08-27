import { type ColumnDef } from '@tanstack/react-table'
import { ArrowLeft, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { toast } from 'sonner'

import { DataTable } from '@/components/data-table/data-table'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { canWrite } from '@/lib/auth'
import { importStockRows, type StockImportRowResult } from '@/services/stock-import'
import {
  downloadStockImportSample,
  parseStockImportFile,
  type StockImportDraft,
} from '@/utils/stock-import'

export default function StockImportPage() {
  const writable = canWrite()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<StockImportDraft[]>([])
  const [results, setResults] = useState<StockImportRowResult[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const validCount = rows.filter((row) => row.errors.length === 0).length
  const errorCount = rows.length - validCount

  const previewColumns = useMemo<ColumnDef<StockImportDraft>[]>(
    () => [
      { accessorKey: 'rowNumber', header: 'Row' },
      {
        id: 'product',
        header: 'Product',
        accessorFn: (row) => row.name || row.sku || row.asset_tag,
      },
      { accessorKey: 'sku', header: 'SKU' },
      { accessorKey: 'quantity', header: 'Qty' },
      { accessorKey: 'warehouse', header: 'Warehouse' },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.errors.length > 0 ? (
            <Badge variant="destructive">Needs fix</Badge>
          ) : (
            <Badge variant="success">Ready</Badge>
          ),
      },
      {
        id: 'errors',
        header: 'Notes',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.errors.join('; ') || '—'}
          </span>
        ),
      },
    ],
    [],
  )

  const resultColumns = useMemo<ColumnDef<StockImportRowResult>[]>(
    () => [
      { accessorKey: 'rowNumber', header: 'Row' },
      { accessorKey: 'productName', header: 'Product' },
      {
        id: 'result',
        header: 'Result',
        cell: ({ row }) =>
          row.original.ok ? (
            <Badge variant="success">Imported</Badge>
          ) : (
            <Badge variant="destructive">Failed</Badge>
          ),
      },
      { accessorKey: 'message', header: 'Message' },
    ],
    [],
  )

  if (!writable) {
    return <Navigate to="/inventory" replace />
  }

  const handleFile = async (file: File) => {
    setIsParsing(true)
    setResults([])
    setFileName(file.name)
    try {
      const buffer = await file.arrayBuffer()
      const parsed = parseStockImportFile(buffer)
      if (parsed.length === 0) {
        setRows([])
        toast.error('No data rows found in this file')
        return
      }
      setRows(parsed)
      toast.success(`Loaded ${parsed.length} row(s) from ${file.name}`)
    } catch {
      setRows([])
      toast.error('Could not read this file. Use the sample CSV or Excel template.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleImport = async () => {
    if (validCount === 0) {
      toast.error('Fix row errors before importing')
      return
    }
    setIsImporting(true)
    try {
      const imported = await importStockRows(rows)
      setResults(imported)
      const failed = imported.filter((row) => !row.ok).length
      const succeeded = imported.length - failed
      if (failed === 0) {
        toast.success(`Imported ${succeeded} row(s)`)
      } else {
        toast.error(`Imported ${succeeded} row(s), ${failed} failed`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="-ml-2 w-fit">
        <Link to="/inventory">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Inventory
        </Link>
      </Button>

      <PageHeader
        title="Bulk stock import"
        description="Upload a CSV or Excel file to add opening stock. Match existing products by SKU or asset tag, or create new products by name."
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Bulk import' },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => downloadStockImportSample('csv')}>
              <Download className="mr-2 h-4 w-4" />
              Sample CSV
            </Button>
            <Button variant="outline" onClick={() => downloadStockImportSample('xlsx')}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Sample Excel
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Template columns</CardTitle>
          <CardDescription>
            Required: <strong>quantity</strong> plus one of <strong>sku</strong>,{' '}
            <strong>asset_tag</strong>, or <strong>name</strong>. Warehouse uses the
            warehouse name or code; leave it blank to use the default warehouse.
            Serial-tracked rows need a matching number of serials separated by{' '}
            <code>|</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="max-w-sm"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose file
            </Button>
            {fileName && (
              <span className="text-sm text-muted-foreground">{fileName}</span>
            )}
            {isParsing && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          <p className="text-sm text-muted-foreground">
            You can also start from{' '}
            <a
              className="text-primary hover:underline"
              href="/templates/stock-import-sample.csv"
              download
            >
              stock-import-sample.csv
            </a>
            .
          </p>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                {validCount} ready, {errorCount} need fixes. Invalid rows are skipped.
              </CardDescription>
            </div>
            <Button onClick={() => void handleImport()} disabled={isImporting || validCount === 0}>
              {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {validCount} row{validCount === 1 ? '' : 's'}
            </Button>
          </CardHeader>
          <CardContent>
            <DataTable columns={previewColumns} data={rows} />
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Import results</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable columns={resultColumns} data={results} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
