import { expect, it } from 'vitest'
import { validReturnTarget } from '../../app/router/return-target'

it.each(['/management', '/processing/projects/prj-sales', '/management/projects?workspace=ws-acme', '/processing', '/processing/new', '/processing/projects/prj-sales/review', '/processing/projects/prj-sales?theme=light#cube'])('accepts registered return target %s', target => {
  expect(validReturnTarget(target)).toBe(target)
})

it.each(['/workspaces', '/workspaces?view=local#top', '/workspaces/3d-dataset', '/workspaces/3d-dataset?theme=light#cube', '//evil.test', '/processing/unknown', '/management/settings/unknown', '/processing/projects/prj-sales/unknown', '/processing/projects/prj-sales/extra', '/management/projects/prj-sales', '/management/projects?workspace=../other'])('rejects invalid return target %s', target => {
  expect(validReturnTarget(target)).toBe('/processing')
})
