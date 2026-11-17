// Detect separators only outside quotes in the header; never split quoted data with String.split.
export function parseLocalCsv(text: string): { delimiter: ',' | ';' | '\t' | '|'; headers: string[]; rows: string[][] } {
  const source = text.replace(/^\uFEFF/, '')
  const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 }
  let quoted = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { i++; continue }
      quoted = !quoted
    } else if (!quoted) {
      if (char === '\r' || char === '\n') break
      if (char === ',' || char === ';' || char === '\t' || char === '|') counts[char]++
    }
  }
  const delimiter = ([',', ';', '\t', '|'] as const).reduce((best, value) => counts[value] > counts[best] ? value : best, ',')
  const records: string[][] = []
  let row: string[] = [], value = '', inQuotes = false, closedQuote = false, recordStarted = false
  const field = () => { row.push(value); value = ''; closedQuote = false }
  const record = () => {
    if (recordStarted || row.length || value.length || closedQuote) { field(); records.push(row) }
    row = []; value = ''; closedQuote = false; recordStarted = false
  }
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') { value += '"'; i++ }
        else { inQuotes = false; closedQuote = true }
      } else value += char
      continue
    }
    if (char === delimiter) { field(); recordStarted = true }
    else if (char === '\r' || char === '\n') {
      record()
      if (char === '\r' && source[i + 1] === '\n') i++
    } else if (char === '"' && !value.length && !closedQuote) { inQuotes = true; recordStarted = true }
    else {
      if (closedQuote || char === '"') throw new Error(`CSV sai dấu nháy tại record ${records.length + 1}.`)
      value += char; recordStarted = true
    }
  }
  if (inQuotes) throw new Error('CSV có ô chưa đóng dấu nháy.')
  record()
  const headers = records.shift()
  if (!headers || headers.every(header => !header.trim())) throw new Error('File CSV chưa có dòng tiêu đề hợp lệ.')
  const invalid = records.findIndex(item => item.length !== headers.length)
  if (invalid !== -1) throw new Error(`Record dữ liệu ${invalid + 1} có ${records[invalid]?.length} ô; cần ${headers.length} ô theo tiêu đề.`)
  return { delimiter, headers, rows: records }
}
