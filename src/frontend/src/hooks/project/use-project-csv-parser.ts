import { parseLocalCsv } from '../../services/management/csv-preview'
export { validateCsvFile } from '../../services/management/upload-validation'

// Preview CSV in the 2D import flow without importing the 3D scene parser.
export const useProjectCsvParser = () => parseLocalCsv
