import { expect, it } from 'vitest'
import { localCsvResources, parseLocalCsv } from '../../math/workspace-3d/local-csv'
import { validateResources } from '../../math/workspace-3d/resource-layout'

it('reads UTF-8 BOM, semicolons, CRLF, escaped quotes, embedded separators and multiline cells without coercion', () => {
  const result = parseLocalCsv('\uFEFFcode;note;amount\r\n001;"a;b";0\r\n002;"say ""Hi""\nnext";\r\n')
  expect(result).toEqual({ delimiter: ';', headers: ['code', 'note', 'amount'], rows: [
    ['001', 'a;b', '0'], ['002', 'say "Hi"\nnext', ''],
  ] })
})

it('reads commas/tabs, preserves duplicate headers, empty fields and formula-like text as strings', () => {
  expect(parseLocalCsv('a,a,b\n1,,=1+1\n').rows).toEqual([['1', '', '=1+1']])
  expect(parseLocalCsv('a\tb\n"x,y"\tz').delimiter).toBe('\t')
  expect(parseLocalCsv('a,b\n\n,\n').rows).toEqual([['', '']])
  expect(parseLocalCsv('a,b\n').rows).toEqual([])
})

it.each(['', '\n', ' , \n', 'a,b\n1', 'a,b\n1,2,3', 'a,b\n1,"open', 'a\n"x"tail', 'a\nx"y'])('rejects malformed CSV explicitly: %j', text => {
  expect(() => parseLocalCsv(text)).toThrow()
})

it('maps two local files to five nodes without joining records or using the filename as identity', () => {
  const documents = ['one', 'two'].map(id => ({ id, name: 'same.csv', ...parseLocalCsv('a,b\n1,2') }))
  const resources = localCsvResources(documents)
  expect(resources).toHaveLength(5)
  expect(validateResources(resources).ok).toBe(true)
  expect(new Set(resources.map(node => node.id)).size).toBe(5)
  expect(resources.filter(node => node.kind === 'dataset').map(node => node.parentId)).toEqual(['local-project:one', 'local-project:two'])
})
