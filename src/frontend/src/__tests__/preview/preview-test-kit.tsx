import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { expect, vi } from 'vitest'
import { PreviewSessionProvider } from '../../views/preview/preview-session'
import { previewMockStore } from '../../services/preview/preview-mock.service'
import type { PreviewRouteIds } from '../../types/preview/preview-route.types'
import type { PreviewUniverseNavigator } from '../../types/preview/preview-session.types'

// Khung test chung cho ba suite của batch 2D (shell · views · interactions).
// File không có đuôi .test nên vitest không coi nó là một suite; tsc -b vẫn kiểm tra.

// Mock store là singleton cấp module. Thao tác chuột giờ SỬA dữ liệu thật (yêu thích,
// đổi tên, xóa, đánh dấu đã đọc) nên mọi test phải reset — nếu không số đếm của test
// sau lệch theo thay đổi mà test trước để lại, và lỗi chỉ hiện khi chạy cả file.
export const resetPreviewStore = (): void => { previewMockStore.reset() }

// Trang 3D của T là một lần tải trang thật; jsdom không điều hướng được nên lối đi đó
// phải inject. Spy dùng chung một instance: clearMocks trong vitest.config.ts xóa lịch
// sử gọi giữa mỗi test, còn implementation (không làm gì) được giữ.
export const universeNavigator = vi.fn<PreviewUniverseNavigator>()

// Mọi view (Home · Workspaces · Projects) và PreviewShell đều đọc usePreviewSession,
// nên không render được chúng nếu thiếu provider — render trực tiếp sẽ throw.
export const renderFrame = (children: ReactNode, routeIds: PreviewRouteIds = {}): ReturnType<typeof render> =>
  render(<PreviewSessionProvider routeIds={routeIds} navigateUniverse={universeNavigator}>
    {children}
  </PreviewSessionProvider>)

// Bất biến shared-ui: "nút disabled cần lý do dễ tiếp cận trong text/context, không chỉ
// tooltip". Test bắt TOÀN BỘ nút đã tắt, không chọn mẫu — thêm một nút chết im lặng là
// hỏng yêu cầu, và người duyệt không có cách nào biết nếu chỉ kiểm vài nút.
export const disabledButtons = (): HTMLButtonElement[] =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('button[disabled]'))
    // Nút phân trang ở biên (trang đầu/cuối) tắt là trạng thái hợp lệ và tự giải thích
    // bằng số trang đang thấy → không thuộc nhóm "nút chết vì thiếu contract".
    .filter(button => !button.closest('.pagination'))

export const everyDisabledButtonHasVisibleReason = (): void => {
  const list = disabledButtons()
  // KHÔNG assert list.length > 0: Home gọn theo đặc tả đã bỏ mọi nút "sắp có" (quick actions),
  // nên một trang hợp lệ có thể có 0 nút tắt. Bất biến thật là CHIỀU MỘT: nếu có nút tắt thì
  // mọi nút tắt phải có lý do nhìn thấy — thêm một nút chết im lặng vẫn bị bắt.
  for (const button of list) {
    const noteId = button.getAttribute('aria-describedby')
    const who = button.getAttribute('aria-label') ?? button.textContent ?? '?'
    expect(noteId, `nút "${who}" không có aria-describedby`).toBeTruthy()
    const note = document.getElementById(noteId ?? '')
    expect(note, `thiếu note #${noteId} cho nút "${who}"`).not.toBeNull()
    // ">20 ký tự" chặn một cạm cụ thể: aria-describedby trỏ về một id hợp lệ nhưng rỗng
    // (ví dụ note nằm trong popover đang đóng) thì vẫn "có" mà không nói gì.
    expect((note?.textContent ?? '').length, `note #${noteId} quá ngắn để là một lý do`).toBeGreaterThan(20)
  }
}

const byCardHeading = (selector: string, title: string): HTMLElement => {
  // Thẻ là <article role="button"> chứa <h3> tên; bên trong còn nút ★/⋯ nên không tìm
  // theo accessible name của thẻ (sẽ bao gồm cả chữ của nút con).
  const found = Array.from(document.querySelectorAll<HTMLElement>(selector))
    .find(card => card.querySelector('h3')?.textContent === title)
  if (!found) throw new Error(`Không tìm thấy thẻ "${title}" (${selector}) trong dữ liệu mẫu`)
  return found
}

export const cardByTitle = (title: string): HTMLElement => byCardHeading('.resource-card', title)
export const miniCardByTitle = (title: string): HTMLElement => byCardHeading('.mini-card', title)

// Dòng bảng trên Home (project và dataset) — <th> đầu dòng chứa tên, phía sau còn phần
// mô tả nên so khớp mở đầu thay vì bằng tuyệt đối.
export const rowByTitle = (title: string): HTMLTableRowElement => {
  const found = Array.from(document.querySelectorAll<HTMLTableRowElement>('.preview-table tbody tr'))
    .find(row => row.querySelector('th')?.textContent?.startsWith(title) ?? false)
  if (!found) throw new Error(`Không tìm thấy dòng "${title}" trong bảng dữ liệu mẫu`)
  return found
}

// Menu ngữ cảnh tự đặt tên theo bản ghi → một truy vấn đủ định vị, không cần giữ container.
export const menuFor = (name: string): HTMLElement =>
  screen.getByRole('menu', { name: `Thao tác với ${name}` })

export const menuItem = (name: RegExp | string): HTMLElement =>
  screen.getByRole('menuitem', { name })
