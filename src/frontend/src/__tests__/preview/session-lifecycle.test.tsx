import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { usePreviewSessionModel } from '../../hooks/preview/use-preview-session'
import { previewMockStore as store } from '../../services/preview/preview-mock.service'
import { requireDefined } from '../../utils/required-value'

beforeEach(() => { store.reset('demo'); vi.useFakeTimers() })
afterEach(() => { cleanup(); vi.useRealTimers() })

it('expires a notification at its deadline and clears timers on unmount', async () => {
  const hook = renderHook(() => usePreviewSessionModel({}))
  act(() => hook.result.current.notify('Transient message'))
  expect(hook.result.current.toasts.map(toast => toast.text)).toEqual(['Transient message'])
  await act(() => vi.advanceTimersByTimeAsync(3199))
  expect(hook.result.current.toasts).toHaveLength(1)
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(hook.result.current.toasts).toEqual([])
  act(() => hook.result.current.notify('Unmount pending'))
  hook.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('lets callers dismiss a toast immediately without a later duplicate dismissal', () => {
  const hook = renderHook(() => usePreviewSessionModel({}))
  act(() => hook.result.current.notify('Dismiss me', 'success'))
  const toast = requireDefined(hook.result.current.toasts[0], 'toast')
  act(() => hook.result.current.dismissToast(toast.id))
  expect(hook.result.current.toasts).toEqual([])
  expect(vi.getTimerCount()).toBe(0)
})

it('reports a missing project without navigating to it', () => {
  const navigate = vi.fn()
  const hook = renderHook(() => usePreviewSessionModel({}, vi.fn(), navigate))
  act(() => hook.result.current.run('open', { kind: 'project', id: 'missing', name: 'Missing' }))
  expect(navigate).not.toHaveBeenCalled()
  expect(hook.result.current.toasts).toMatchObject([{ text: 'Project không còn tồn tại.', tone: 'info' }])
})

it('ignores rename/remove submissions without a matching dialog and rejects a blank rename', () => {
  const hook = renderHook(() => usePreviewSessionModel({}))
  const before = store.getState()
  act(() => { void hook.result.current.submitRename('ignored'); void hook.result.current.confirmRemove() })
  expect(store.getState()).toBe(before)
  const project = requireDefined(before.projects[0], 'project')
  act(() => hook.result.current.run('rename', { kind: 'project', id: project.id, name: project.name }))
  act(() => { void hook.result.current.submitRename('   ') })
  expect(hook.result.current.dialog?.mode).toBe('rename')
  expect(hook.result.current.toasts).toMatchObject([{ text: 'Tên để trống không được chấp nhận.', tone: 'danger' }])
  expect(store.getState()).toBe(before)
})

it('turns a rejected membership mutation into an error toast without changing the store', async () => {
  const hook = renderHook(() => usePreviewSessionModel({}))
  const before = store.getState()
  await act(() => {
    hook.result.current.removeProjectMember('missing', 'unknown')
    return Promise.resolve()
  })
  expect(hook.result.current.toasts).toMatchObject([{ tone: 'danger', text: 'thành viên không còn trong project này' }])
  expect(store.getState()).toBe(before)
})

it('restores an undoable mutation and keeps success feedback separate from its undo notification', async () => {
  const hook = renderHook(() => usePreviewSessionModel({}))
  const project = requireDefined(store.getState().projects[0], 'project')
  act(() => hook.result.current.run('rename', { kind: 'project', id: project.id, name: project.name }))
  act(() => { void hook.result.current.submitRename('A new project name') })
  await act(() => vi.advanceTimersByTimeAsync(160))
  expect(store.getState().projects.find(item => item.id === project.id)?.name).toBe('A new project name')
  const toast = requireDefined(hook.result.current.toasts.find(item => item.onUndo), 'undo toast')
  act(() => { expect(toast.onUndo?.()).toBe(true) })
  expect(store.getState().projects.find(item => item.id === project.id)?.name).toBe(project.name)
  expect(hook.result.current.toasts.some(item => item.text === 'Đã hoàn tác thao tác vừa rồi.')).toBe(true)
})
