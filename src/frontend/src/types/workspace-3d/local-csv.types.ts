export type LocalCsvDocument = {
  id: string
  name: string
  delimiter: ',' | ';' | '\t'
  headers: string[]
  rows: string[][]
}
