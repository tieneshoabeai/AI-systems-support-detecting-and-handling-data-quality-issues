import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Project, ProjectModuleId } from '../../types/preview/preview.types'
import {
  formatCount, formatDataSize, formatRows, projectModules,
} from './preview-data'
import { PreviewShell } from './components/preview-shell'
import { PreviewIcon } from './components/preview-icons'
import { EmptyHint, StatusBadge } from './components/preview-primitives'
import { usePreviewSession } from './preview-session-context'
import { projectDatasetMenu } from './preview-menu'
import { ResourceAvatar, ResourceAvatarPicker } from './components/resource-avatar'

// Trang "Project Workspace Overview" — ảnh UI-UX/projects/DataVerse_Project_Workspace_Overview_v1,
// dựng đúng bốn vùng của ảnh, từ trên xuống:
//   1. thanh trên cùng + sidebar TRÁI: giữ nguyên, là của shell (preview-shell / preview-topbar).
//   2. DẢI ĐẦU: trái = tên project + mô tả ngắn; phải = thẻ dataset (tên tệp · dung lượng ·
//      shape = số dòng · số cột) và nút ⋯ của chính thẻ đó.
//   3. KHOANG GIỮA: nền tinh vân + MÔ HÌNH 3D CỦA BẠN T (một khối tâm + bốn khối liền kề).
//   4. THANH ĐÁY: bốn module. Đặc tả UI-UX/projects/đặc tả.txt: "ấn các nút này cũng tương tự như
//      ấn vào các ô khối 3d" → bốn nút và bốn khối là MỘT danh sách duy nhất (`projectModules`).
//
// Bốn nút chọn module trong cùng không gian Project. Scene của T được truyền
// qua prop; không có nút điều hướng Universe riêng bên trong Project.
//
// Dữ liệu trang này đọc từ mock store; project nào cũng có route riêng
// '#/preview/projects/<workspaceId>/<projectId>' nên F5 vẫn đứng đúng trang.

// Slot của bốn khối quanh tâm = lưới 2×2 trong CSS, xếp theo THỨ TỰ trong `projectModules`
// (trên-trái · trên-phải · dưới-trái · dưới-phải — đúng vị trí ảnh vẽ). Vị trí nằm ở CSS chứ không
// nằm trong view: thêm một module thứ năm thì chỉ sửa dữ liệu + thêm một ô lưới, không phải sửa JSX.
function ProjectUniverse({ project, selected, scene }: { project: Project; selected: ProjectModuleId; scene?: ReactNode }) {
  const dataset = project.dataset

  return <section className="pj-stage" aria-label={`Vũ trụ dữ liệu của ${project.name}`}>
    {scene ?? <>
      {/* role="img": toàn bộ khoang này là HÌNH minh họa scene của T. Mọi chữ trong nó (tên tệp,
          tên bốn module) đã có chỗ khác đọc được — dải dataset trên đầu và bốn nút dưới thanh —
          nên khai báo là ảnh không làm mất thông tin, mà lặp lại thành hai lần đọc cho screen
          reader. */}
      <div className="pj-universe" role="img" aria-label={
        `Minh họa vũ trụ dữ liệu: khối tâm là ${dataset ? `tập dữ liệu ${dataset.fileName}` : 'project chưa có tập dữ liệu'},`
        + ` quanh bốn khối ${projectModules.map(item => item.label).join(', ')}.`}>
        <span className="pj-orbit pj-orbit-outer" />
        <span className="pj-orbit pj-orbit-inner" />
        <span className={`pj-core${dataset === null ? ' is-empty' : ''}`}>
          <span className="pj-core-cube"><PreviewIcon name="box" /></span>
          <span className="pj-core-name">{dataset ? dataset.fileName : 'chưa có dataset'}</span>
          {dataset && <span className="pj-core-meta">{formatRows(dataset.rows)} · {formatCount(dataset.columns)} cột</span>}
        </span>
        {/* Bốn khối là bốn ô của lưới 2×2 trong CSS, xếp theo đúng thứ tự mảng. */}
        <span className="pj-blocks">
          {projectModules.map(module => <span key={module.id} data-tone={module.tone}
            className={`pj-block${selected === module.id ? ' is-active' : ''}`}>
            <span className="pj-block-icon"><PreviewIcon name={module.icon} /></span>
            <span className="pj-block-text"><strong>{module.label}</strong><small>{module.caption}</small></span>
            <span className="pj-block-stand" />
          </span>)}
        </span>
      </div>
    </>}
  </section>
}

export function ProjectWorkspaceView({ projectId, scene }: { projectId: string; scene?: ReactNode }) {
  const session = usePreviewSession()
  // Module đang được chọn trên thanh đáy. Mặc định = 'overview' vì ảnh vẽ ô "Tổng quan" đang bật.
  const [selected, setSelected] = useState<ProjectModuleId>('overview')
  const project = session.state.projects.find(item => item.id === projectId) ?? null

  // Id không còn trong store (vừa bị xóa) → về danh sách thay vì vẽ trang trống.
  if (!project) return <PreviewShell active="workspaces">
    <EmptyHint title="Không tìm thấy project" note="Project không còn tồn tại. Hãy chọn project khác trong danh sách." />
    <button type="button" className="button-secondary" onClick={() => session.openSection('projects')}>Về danh sách Project</button>
  </PreviewShell>

  const dataset = project.dataset
  const menuButton = (element: HTMLElement) =>
    session.openMenu({ ...projectDatasetMenu(project), origin: { kind: 'anchor', element } })

  return <PreviewShell active="workspaces">
    <div className="pj-head-row">
      <button type="button" className="button-secondary back-button" onClick={() => session.openSection('workspaces', { workspaceId: project.workspaceId })}>
        <PreviewIcon name="arrow-left" /> Quay lại</button>
      <nav className="ws-crumb" aria-label="Path điều hướng">
        <button type="button" className="crumb-link" onClick={() => session.openSection('workspaces')}>Workspaces</button>
        <span className="crumb-sep" aria-hidden="true">›</span>
        <button type="button" className="crumb-link" onClick={() => session.openSection('workspaces', { workspaceId: project.workspaceId })}>{project.workspaceName}</button>
        <span className="crumb-sep" aria-hidden="true">›</span>
        <span className="crumb-current" aria-current="page">{project.name}</span>
      </nav>
    </div>

    {/* DẢI ĐẦU (ảnh, khung A): một hàng hai cột — trái nhận dạng project, phải là THẺ DATASET
        kèm nút ⋯. Nút ⋯ đứng cạnh dataset vì ảnh đặt nó ở đó, còn menu mọc ra từ nó là menu CỦA
        PROJECT (Thông tin Project · Quản lý thành viên · Xóa Project — ảnh B khung 1). */}
    <header className="pj-band">
      <div className="pj-band-id">
        <span className="pj-band-icon" aria-hidden="true"><ResourceAvatar kind="project" id={project.id} fallback="box" /></span>
        <div className="pj-band-text">
          {/* Badge NẰM NGOÀI <h1>: nhét nó vào trong thì tên project đọc thành "Sales Analytics
              Đang hoạt động" — ảnh chỉ đặt hai thứ cạnh nhau, chúng không phải một tiêu đề. */}
          <div className="pj-band-title">
            <h1 id="page-heading" tabIndex={-1} className="pj-band-name">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          {/* Project tạo từ wizard cho phép mô tả rỗng; để trắng một dòng dưới tên là chỗ trống
              không nói gì, thà ghi thẳng trạng thái "chưa có mô tả". */}
          <p className="pj-band-desc">{project.description === '' ? 'Project chưa có mô tả.' : project.description}</p>
        </div>
      </div>

      <div className="pj-dataset">
        <span className="pj-dataset-icon" aria-hidden="true"><PreviewIcon name="file" /></span>
        <div className="pj-dataset-text">
          <strong>{dataset ? `Dataset: ${dataset.fileName}` : 'Dataset'}</strong>
          {/* "dung lượng bao gồm luôn shape()" = kích thước tệp + số dòng + số cột, đúng ba vế
              ảnh vẽ: '124.6 MB | 1,250,000 dòng | 24 cột'. */}
          <span>{dataset
            ? `${formatDataSize(dataset.sizeMb)} | ${formatRows(dataset.rows)} | ${formatCount(dataset.columns)} cột`
            : 'Project chưa có tập dữ liệu.'}</span>
        </div>
        <button type="button" className="icon-button pj-dataset-menu" aria-label={`Thao tác với ${project.name}`}
          aria-haspopup="menu" onClick={event => menuButton(event.currentTarget)}>
          <PreviewIcon name="more" />
        </button>
      </div>
    </header>

    <ResourceAvatarPicker key={project.id} kind="project" id={project.id} />
    <ProjectUniverse project={project} selected={selected} scene={scene} />

    {/* THANH ĐÁY: bốn module. Cùng một danh sách với bốn khối trong scene ở trên, và nút nào
        được chọn thì khối cùng id sáng lên — đó là bằng chứng "bấm dưới đây cũng như bấm khối
        3D" mà đặc tả yêu cầu, thay vì hai bộ nhãn viết tay dễ lệch nhau. */}
    <nav className="pj-modules" aria-label="Bốn module của project">
      {projectModules.map(module => {
        const current = selected === module.id
        return <button type="button" key={module.id} data-tone={module.tone}
          className={`pj-module${current ? ' is-active' : ''}`} aria-current={current ? 'true' : undefined}
          onClick={() => setSelected(module.id)}>
          <span className="pj-module-icon" aria-hidden="true"><PreviewIcon name={module.icon} /></span>
          <span className="pj-module-label">{module.label}</span>
        </button>
      })}
    </nav>

    {/* Trang không còn dải lý do cho "Quản lý thành viên" hay các control của trang Projects:
        mục đó đã BẬT THẬT và chính modal của nó mang ghi chú ở chân (id `projectMembersPage`).
        Để note trùng id ở đây là hai phần tử cùng một id trong DOM khi modal mở. */}
  </PreviewShell>
}
