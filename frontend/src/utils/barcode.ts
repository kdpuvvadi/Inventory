export function generateAssetTag(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const datePart = `${year}${month}${day}`
  const sequence = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `AST-${datePart}-${sequence}`
}

export function generateBarcodeValue(assetTag: string): string {
  return assetTag.replace(/-/g, '')
}
