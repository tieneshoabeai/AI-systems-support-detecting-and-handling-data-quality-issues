import type { PreviewToast } from '../../../types'
import { Toast } from '../../../components/ui/overlay/toast'

export function PreviewToaster({ toasts, onDismiss }: { toasts: PreviewToast[]; onDismiss: (id: string) => void }) {
  return <Toast toasts={toasts} onDismiss={onDismiss} label="Kết quả thao tác" />
}
