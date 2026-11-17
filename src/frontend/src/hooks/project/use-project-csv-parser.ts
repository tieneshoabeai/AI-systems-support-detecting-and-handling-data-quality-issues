import { parseLocalCsv } from '../../services/management/csv-preview'
export { validateCsvFile } from '../../services/management/upload-validation'

// The wizard receives the existing parser through its hook boundary; parsing is unchanged.
export const useProjectCsvParser = () => parseLocalCsv
