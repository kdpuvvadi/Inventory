#!/usr/bin/env node
/**
 * Import PocketBase collections from pb_schema.json.
 * Safe to re-run (merge/update, deleteMissing=false).
 *
 * Env:
 *   PB_URL              default http://127.0.0.1:8090
 *   PB_ADMIN_EMAIL
 *   PB_ADMIN_PASSWORD
 *   PB_SCHEMA_PATH      default ./pb_schema.json relative to this file
 */
import PocketBase from 'pocketbase'
import { readFileSync, existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD
const SCHEMA_PATH = resolve(
  process.env.PB_SCHEMA_PATH || resolve(__dirname, 'pb_schema.json'),
)

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD are required')
  process.exit(1)
}

if (!existsSync(SCHEMA_PATH)) {
  console.error(`Schema file not found: ${SCHEMA_PATH}`)
  process.exit(1)
}

const pb = new PocketBase(PB_URL)
pb.autoCancellation(false)

console.log(`Connecting to ${PB_URL}...`)
await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD)

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
const existing = await pb.collections.getFullList()
const usersExisting = existing.find((c) => c.name === 'users')

const hasAppCollections = existing.some((c) => c.name === 'products')
const hasContactModel =
  existing.some((c) => c.name === 'departments') &&
  existing.some((c) => c.name === 'contacts')
const hasSerialModel = existing.some((c) => c.name === 'product_serials')
const hasDocumentsModel =
  existing.some((c) => c.name === 'documents') &&
  existing.some((c) => c.name === 'document_items')
const documentsCol = existing.find((c) => c.name === 'documents')
const hasDocumentConversionFields = Boolean(
  documentsCol?.fields?.some((f) => f.name === 'source_document') &&
    documentsCol?.fields?.some((f) => f.name === 'converted_to'),
)
const hasDocumentShareFields = Boolean(
  documentsCol?.fields?.some((f) => f.name === 'share_token') &&
    documentsCol?.fields?.some((f) => f.name === 'pdf_file') &&
    documentsCol?.fields?.some((f) => f.name === 'gst_type') &&
    documentsCol?.fields?.some((f) => f.name === 'billing_state'),
)
const bomsCol = existing.find((c) => c.name === 'boms')
const hasBomProjectField = Boolean(
  bomsCol?.fields?.some((f) => f.name === 'project'),
)
const hasBomApprovedStatus = Boolean(
  bomsCol?.fields?.some(
    (f) =>
      f.name === 'status' &&
      Array.isArray(f.values) &&
      f.values.includes('approved'),
  ),
)
const customersCol = existing.find((c) => c.name === 'customers')
const hasCustomerAddressFields = Boolean(
  customersCol?.fields?.some((f) => f.name === 'state') &&
    customersCol?.fields?.some((f) => f.name === 'pincode'),
)
const productsCol = existing.find((c) => c.name === 'products')
const settingsCol = existing.find((c) => c.name === 'app_settings')
const hasTrackSerialsField = Boolean(
  productsCol?.fields?.some((f) => f.name === 'track_serials'),
)
const hasCompanyBrandingFields = Boolean(
  settingsCol?.fields?.some((f) => f.name === 'company_logo') &&
    settingsCol?.fields?.some((f) => f.name === 'site_name'),
)
const hasCompanyStateFields = Boolean(
  settingsCol?.fields?.some((f) => f.name === 'company_state') &&
    settingsCol?.fields?.some((f) => f.name === 'company_pincode'),
)
const schemaComplete =
  hasAppCollections &&
  hasContactModel &&
  hasSerialModel &&
  hasTrackSerialsField &&
  hasDocumentsModel &&
  hasCompanyBrandingFields &&
  hasDocumentConversionFields &&
  hasDocumentShareFields &&
  hasCustomerAddressFields &&
  hasCompanyStateFields &&
  hasBomProjectField &&
  hasBomApprovedStatus

if (schemaComplete && process.env.PB_FORCE_SCHEMA_IMPORT !== 'true') {
  console.log(
    `App collections already present (${existing.length} total). Skipping import.`,
  )
  console.log(
    'Set PB_FORCE_SCHEMA_IMPORT=true to re-import/update collections.',
  )
  process.exit(0)
}

if (hasAppCollections && !schemaComplete) {
  console.log(
    'Existing install detected — merging schema update (documents/share/address/GST/BOM)...',
  )
}

const DEFAULT_TEMPLATES = {
  verificationTemplate: {
    subject: 'Verify your {APP_NAME} email',
    body: '<p>Hello,</p>\n<p>Click below to verify your email:</p>\n<p><a href="{APP_URL}/_/#/auth/confirm-verification/{TOKEN}">Verify</a></p>\n<p>Thanks,<br/>{APP_NAME} team</p>',
  },
  resetPasswordTemplate: {
    subject: 'Reset your {APP_NAME} password',
    body: '<p>Hello,</p>\n<p>Click below to reset your password:</p>\n<p><a href="{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}">Reset password</a></p>\n<p>Thanks,<br/>{APP_NAME} team</p>',
  },
  confirmEmailChangeTemplate: {
    subject: 'Confirm your {APP_NAME} new email address',
    body: '<p>Hello,</p>\n<p>Click below to confirm your new email:</p>\n<p><a href="{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}">Confirm</a></p>\n<p>Thanks,<br/>{APP_NAME} team</p>',
  },
}

const fixed = schema.map((col) => {
  if (col.name !== 'users') return col

  const merged = {
    ...col,
    id: usersExisting?.id || col.id,
    verificationTemplate:
      usersExisting?.verificationTemplate || DEFAULT_TEMPLATES.verificationTemplate,
    resetPasswordTemplate:
      usersExisting?.resetPasswordTemplate || DEFAULT_TEMPLATES.resetPasswordTemplate,
    confirmEmailChangeTemplate:
      usersExisting?.confirmEmailChangeTemplate ||
      DEFAULT_TEMPLATES.confirmEmailChangeTemplate,
    authAlert: usersExisting?.authAlert || {
      enabled: true,
      emailTemplate: {
        subject: 'Login from a new location',
        body: '<p>Hello,</p><p>A new login was detected.</p><p>If this was not you, reset your password.</p>',
      },
    },
    otp: usersExisting?.otp || {
      enabled: false,
      duration: 300,
      length: 8,
      emailTemplate: {
        subject: 'OTP for {APP_NAME}',
        body: '<p>Your one-time password is: <strong>{OTP}</strong></p>',
      },
    },
  }

  if (usersExisting?.fields) {
    const customNames = new Set(['name', 'role', 'avatar'])
    const systemFields = usersExisting.fields.filter((f) => !customNames.has(f.name))
    const customFields = (col.fields || []).filter((f) => customNames.has(f.name))
    merged.fields = [...systemFields, ...customFields]
  }

  return merged
})

console.log(`Importing ${fixed.length} collections from ${SCHEMA_PATH}...`)
try {
  await pb.collections.import(fixed, false)
  console.log('Schema import OK')
} catch (e) {
  console.error('Import failed:', e.status)
  console.error(JSON.stringify(e.response, null, 2))
  process.exit(1)
}

const cols = await pb.collections.getFullList()
console.log(
  'Collections:',
  cols
    .map((c) => c.name)
    .sort()
    .join(', '),
)
