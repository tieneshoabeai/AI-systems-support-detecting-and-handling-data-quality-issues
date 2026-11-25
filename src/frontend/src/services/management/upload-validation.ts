export function validateCsvFile(file: File): void {
  if (!/\.csv$/i.test(file.name)) throw new Error('Chỉ hỗ trợ tệp CSV.')
  if (!file.size) throw new Error('Tệp CSV không được rỗng.')
  if (file.size > 50 * 1024 * 1024) throw new Error('Tệp CSV tối đa 50 MB.')
}
