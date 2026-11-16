import { parseLocalCsv } from '../../math/workspace-3d/local-csv'

// The wizard receives the existing parser through its hook boundary; parsing is unchanged.
export const useProjectCsvParser = () => parseLocalCsv
