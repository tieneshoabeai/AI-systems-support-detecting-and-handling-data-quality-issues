import { expect, it } from 'vitest'
import { parseLocalCsv } from '../../services/management/csv-preview'
it('recognizes pipes and preserves quoted delimiters and multiline values', () => {
  expect(parseLocalCsv('id|note\n1|"a|b\nc"')).toEqual({ delimiter: '|', headers: ['id', 'note'], rows: [['1', 'a|b\nc']] })
})
