export function extractSearchableText(value: any): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (!value || typeof value !== 'object') {
    return ''
  }
  if (Array.isArray(value)) {
    return value
      .map(item => extractSearchableText(item))
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  const typedText = extractTypedSearchableText(value)
  if (typedText) {
    return typedText
  }

  const directKeys = [
    'formattedContent',
    'content',
    'displayContent',
    'name',
    'title',
    'label',
  ]
  for (const key of directKeys) {
    const text = extractSearchableText(value[key])
    if (text) {
      return text
    }
  }

  const nestedKeys = [
    'block',
    'date',
    'email',
    'mAsset',
    'mSelect',
    'number',
    'phone',
    'relation',
    'rollup',
    'select',
    'text',
    'url',
  ]
  for (const key of nestedKeys) {
    const text = extractSearchableText(value[key])
    if (text) {
      return text
    }
  }

  return ''
}

export function resolveKeyName(key: Record<string, any>) {
  const text = extractSearchableText(key)
  return text || String(key.id ?? key.keyID ?? '')
}

function extractTypedSearchableText(value: Record<string, any>) {
  const valueType = String(value.type ?? value.valueType ?? '').toLowerCase()
  switch (valueType) {
    case 'block':
      return extractSearchableText(value.block ?? value.text ?? '')
    case 'checkbox':
      return value.checkbox?.checked ? 'true' : ''
    case 'created':
    case 'createdat':
      return formatAttributeViewTimestamp(value.created ?? value.createdAt ?? value.date ?? value)
    case 'date':
      return formatAttributeViewDate(value.date ?? value)
    case 'masset':
      return extractAssetSearchableText(value.mAsset ?? value)
    case 'mselect':
      return extractSearchableText(value.mSelect ?? value.select ?? [])
    case 'number':
      return extractNumberSearchableText(value.number ?? value)
    case 'relation':
      return extractRelationSearchableText(value.relation ?? value)
    case 'rollup':
      return extractRollupSearchableText(value.rollup ?? value)
    case 'select':
      return extractSearchableText(value.select ?? value.mSelect ?? [])
    case 'text':
      return extractSearchableText(value.text ?? value)
    case 'updated':
    case 'updatedat':
      return formatAttributeViewTimestamp(value.updated ?? value.updatedAt ?? value.date ?? value)
    default:
      break
  }

  if (value.mAsset) {
    return extractAssetSearchableText(value.mAsset)
  }
  if (value.relation) {
    return extractRelationSearchableText(value.relation)
  }
  if (value.rollup) {
    return extractRollupSearchableText(value.rollup)
  }
  if (value.date) {
    return formatAttributeViewDate(value.date)
  }
  if (value.number) {
    return extractNumberSearchableText(value.number)
  }
  if (value.url) {
    return extractSearchableText(value.url)
  }
  if (value.email) {
    return extractSearchableText(value.email)
  }
  if (value.phone) {
    return extractSearchableText(value.phone)
  }

  return ''
}

function extractAssetSearchableText(assets: any) {
  if (!Array.isArray(assets)) {
    return ''
  }

  return assets
    .flatMap((asset) => [
      extractSearchableText(asset?.name),
      extractSearchableText(asset?.content),
    ])
    .filter(Boolean)
    .join(' ')
    .trim()
}

function extractNumberSearchableText(numberValue: any) {
  if (!numberValue || typeof numberValue !== 'object') {
    return extractSearchableText(numberValue)
  }

  return extractSearchableText(numberValue.formattedContent)
    || extractSearchableText(numberValue.content)
}

function extractRelationSearchableText(relationValue: any) {
  if (!relationValue || typeof relationValue !== 'object') {
    return ''
  }

  return extractSearchableText(relationValue.contents ?? relationValue.blockIDs ?? [])
}

function extractRollupSearchableText(rollupValue: any) {
  if (!rollupValue || typeof rollupValue !== 'object') {
    return ''
  }

  return extractSearchableText(rollupValue.contents ?? [])
}

function formatAttributeViewDate(dateValue: any) {
  if (!dateValue || typeof dateValue !== 'object') {
    return extractSearchableText(dateValue)
  }

  const formatted = extractSearchableText(dateValue.formattedContent)
  if (formatted) {
    return formatted
  }

  const parts = [
    formatAttributeViewTimestamp(dateValue.content, !dateValue.isNotTime),
  ]
  if (dateValue.hasEndDate && dateValue.isNotEmpty2) {
    const end = formatAttributeViewTimestamp(dateValue.content2, !dateValue.isNotTime)
    if (end) {
      parts.push(end)
    }
  }

  return parts.filter(Boolean).join(' ').trim()
}

function formatAttributeViewTimestamp(rawValue: any, includeTime = true) {
  const timestamp = Number(rawValue)
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return ''
  }

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  if (!includeTime) {
    return `${year}-${month}-${day}`
  }

  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}
