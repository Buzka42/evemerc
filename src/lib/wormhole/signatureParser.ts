import type { ParsedSignature, SignatureCatalogEntry } from './types'

export function parseProbeScanner(text: string, catalog: SignatureCatalogEntry[] = []): ParsedSignature[] {
  return text.split(/\r?\n/).flatMap((line) => {
    const fields = line.split('\t')
    const signatureId = fields[0]?.trim()
    if (!signatureId || !/^[A-Z]{3}-\d{3}$/.test(signatureId)) return []

    const scanGroup = fields[1]?.trim() ?? ''
    const categoryName = scanGroup === 'Cosmic Signature' ? fields[2]?.trim() ?? '' : ''
    const typeName = scanGroup === 'Cosmic Signature' ? fields[3]?.trim() ?? '' : fields[2]?.trim() ?? ''
    const matched = catalog.find((entry) => entry.name === typeName && entry.categoryName === categoryName)
    const category = matched ?? catalog.find((entry) => entry.categoryName === categoryName)

    return [{
      signature_id: signatureId,
      signature_category_id: category?.categoryId ?? null,
      signature_type_id: matched?.id ?? null,
      raw_type_name: matched ? null : typeName || null,
    }]
  })
}
