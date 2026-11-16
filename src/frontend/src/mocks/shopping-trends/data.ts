import metadata from './dataset.json'
import analysis from './analysis.json'
import detection from './detection.json'
export { metadata, analysis, detection }
export const shoppingProjectId = 'shopping-trends'
export const shoppingRecordsHref = '/processing/projects/shopping-trends/records'
export const loadShoppingRows = async (): Promise<string[][]> => {
  const batches = await Promise.all([
    import('./records-0.json'), import('./records-1.json'), import('./records-2.json'), import('./records-3.json'),
    import('./records-4.json'), import('./records-5.json'), import('./records-6.json'), import('./records-7.json'),
  ])
  return batches.flatMap(batch => batch.default)
}
export const downloadShopping = async (kind: 'csv' | 'report') => {
  let body: string
  if (kind === 'csv') {
    const quote = (value: string) => /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value
    body = [metadata.columns, ...await loadShoppingRows()].map(row => row.map(quote).join(',')).join('\n') + '\n'
  } else body = JSON.stringify({ metadata, analysis, detection }, null, 2)
  const url = URL.createObjectURL(new Blob([body], { type: kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = kind === 'csv' ? metadata.fileName : 'shopping-quality-report.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
