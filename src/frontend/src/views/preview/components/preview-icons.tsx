// Icon inline SVG (stroke 1.75, viewBox 24) — không thêm icon library vì rule nhóm
// cấm tự ý thêm dependency. Bộ icon dùng chung cho sidebar và các thẻ.
const paths: Record<string, string> = {
  home: 'M4 11.2 12 4.4l8 6.8M6.4 9.8V19a1 1 0 0 0 1 1h10.2a1 1 0 0 0 1-1V9.8',
  workspaces: 'M4 8.6a2 2 0 0 1 2-2h3.2l1.6 2H18a2 2 0 0 1 2 2v6.8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
  projects: 'M5 10.5V7a2 2 0 0 1 2-2h3l2 2.4h5a2 2 0 0 1 2 2v1.1M4.2 10.5h15.6a1 1 0 0 1 1 1.1l-.9 6.2a2 2 0 0 1-2 1.7H6.1a2 2 0 0 1-2-1.7l-.9-6.2a1 1 0 0 1 1-1.1z',
  datasets: 'M12 4.6c3.9 0 7 1.3 7 2.9s-3.1 2.9-7 2.9-7-1.3-7-2.9 3.1-2.9 7-2.9zM5 7.5v9c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9v-9M5 12c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9',
  'data-views': 'M4.5 5.5h15v13h-15zM4.5 10.5h15M10 10.5v8M15 10.5v8',
  'clean-rules': 'M6.5 4.5h11l1.5 4.2-7 10.8-7-10.8zM8.6 8.8h6.8M12 4.5v4.3',
  lineage: 'M7.5 6.5a2 2 0 1 0 0-.001zM17 8a2 2 0 1 0 0-.001zM12 18a2 2 0 1 0 0-.001zM8.6 7.6 10.9 16M15.6 9.4 12.9 16.2',
  versions: 'M12 4.8 19 8v5.4c0 3.4-2.9 5.4-7 6.4-4.1-1-7-3-7-6.4V8zM9.6 12.2l1.9 2 3.2-3.6',
  exports: 'M12 15.5V5.5M8.6 8.9 12 5.5l3.4 3.4M5 14.5v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3',
  users: 'M9 11a3.4 3.4 0 1 0 0-6.8A3.4 3.4 0 0 0 9 11zM3.5 20a5.6 5.6 0 0 1 11 0M16.5 8.4a3.2 3.2 0 0 1 0 6.2M18 20a5.4 5.4 0 0 0-2.2-4.3',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM12 3.5l1.4 2.3 2.6-.5.4 2.6 2.3 1.4-1.3 2.3 1.3 2.3-2.3 1.4-.4 2.6-2.6-.5L12 20.5l-1.4-2.3-2.6.5-.4-2.6-2.3-1.4L6.6 12 5.3 9.7l2.3-1.4.4-2.6 2.6.5z',
  plus: 'M12 5.5v13M5.5 12h13',
  upload: 'M12 16.5V6.2M8 10.2 12 6.2l4 4M5 18.8h14',
  export: 'M12 5.8v9.4M8.4 8.8 12 5.2l3.6 3.6M4.8 14.6v3.2a1.6 1.6 0 0 0 1.6 1.6h11.2a1.6 1.6 0 0 0 1.6-1.6v-3.2',
  grid: 'M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z',
  sparkle: 'M11 4.5 12.6 9 17 10.6 12.6 12.2 11 16.7 9.4 12.2 5 10.6 9.4 9zM17.6 15.4l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16.2 16.2 20.5 20.5',
  bell: 'M12 4.8a4.8 4.8 0 0 0-4.8 4.8c0 4-1.6 5.2-1.6 5.2h12.8s-1.6-1.2-1.6-5.2A4.8 4.8 0 0 0 12 4.8zM10.4 18.4a1.8 1.8 0 0 0 3.2 0',
  // Vùng thứ tám của topbar (Design Board): lá cờ "báo cáo vấn đề" — hình báo hiệu, không
  // phải dấu than trong tam giác (đó là icon lỗi, nói sai mức độ của một lời báo cáo).
  report: 'M5.6 20.4V4.4M5.6 5.6l4.2 1.6 4.6-1.6 3.6 1.4v7.6l-3.6-1.4-4.6 1.6-4.2-1.6',
  help: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM9.8 9.6a2.3 2.3 0 1 1 3.4 2.6c-.9.6-1.2 1.1-1.2 2.1M12 17.2h.01',
  filter: 'M5 6.5h14l-5.4 6.4v4.6l-3.2 1.6v-6.2z',
  list: 'M5 6.5h14M5 12h14M5 17.5h9',
  star: 'M12 4.8l2.3 4.9 5.2.7-3.8 3.7.9 5.3-4.6-2.6-4.6 2.6.9-5.3L4.5 10.4l5.2-.7z',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  chevron: 'M9 5.5 15.5 12 9 18.5',
  'chevron-down': 'M6.5 9.5 12 15l5.5-5.5',
  'collapse': 'M11 6.5 6.5 12 11 17.5M17.5 6.5 13 12l4.5 5.5',
  expand: 'M6.5 6.5 11 12l-4.5 5.5M13 6.5 17.5 12 13 17.5',
  drag: 'M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM12 4.5v15M4.5 12h15',
  mouse: 'M12 4.8a5.2 5.2 0 0 1 5.2 5.2v4a5.2 5.2 0 0 1-10.4 0v-4A5.2 5.2 0 0 1 12 4.8zM12 8v3',
  reset: 'M5 12a7 7 0 1 1 2.4 5.3M5 12V7.6M5 12h4.4',
  file: 'M7 4.5h7l3.5 3.5v11.5H7zM13.6 4.8v3.6h3.6M9.4 12.6h5.2M9.4 15.6h5.2',
  arrow: 'M5 12h13.5M13 7.5 18.5 12 13 16.5',
  check: 'M5.5 12.5 9.5 16.5 18.5 7.5',
  'check-circle': 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8 12l2.5 2.5L16 9',
  processing: 'M19.5 9a8 8 0 0 0-13-3L4 8.5M4 4v4.5h4.5M4.5 15a8 8 0 0 0 13 3l2.5-2.5M20 20v-4.5h-4.5',
  activity: 'M3.5 12H7l3-7 4 14 3-7h3.5',
  pause: 'M7 5h3v14H7zM14 5h3v14h-3z',
  archive: 'M4 4.5h16v4H4zM5.5 8.5v11h13v-11M9.5 12h5',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.8V12l3 1.8',
  pencil: 'M5 19h3.4L19 8.4a2 2 0 0 0-2.8-2.8L5.6 16.2 5 19zM15.4 6.8 17.6 9',
  // Nhóm icon mới cho menu ngữ cảnh + topbar: lưu trữ, xóa, đăng xuất, hoàn tác, đóng.
  box: 'M4.5 7.6 12 4.2l7.5 3.4v8.8L12 19.8l-7.5-3.4zM4.5 7.6 12 11l7.5-3.4M12 11v8.8',
  trash: 'M5.5 7.6h13M9.6 7.6V5.4h4.8v2.2M7.2 7.6l.9 11h7.8l.9-11M10.4 10.8v5M13.6 10.8v5',
  logout: 'M14.5 5.2h3.3a1.5 1.5 0 0 1 1.5 1.5v10.6a1.5 1.5 0 0 1-1.5 1.5h-3.3M10 8.4 6.4 12l3.6 3.6M6.4 12h8.4',
  undo: 'M4.4 9.2h11a4.6 4.6 0 1 1 0 9.2H9.2M4.4 9.2 8 5.6M4.4 9.2 8 12.8',
  close: 'M6.6 6.6 17.4 17.4M17.4 6.6 6.6 17.4',
  // Vòng tròn chữ "i" cho header modal "Thông tin Workspace" (Design Board workspaces detail).
  info: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 11v5.5M12 7.9h.01',
  // Nhóm icon cho nhánh "Accounts" của Settings (Design Board 04): khiên bảo mật, chìa
  // đổi mật khẩu, ổ khóa cho trường chỉ đọc, màn hình + điện thoại cho danh sách phiên.
  shield: 'M12 4.4 19 7v5.2c0 3.6-2.9 5.7-7 6.9-4.1-1.2-7-3.3-7-6.9V7zM9.6 12.1l1.7 1.8 3.3-3.7',
  key: 'M8.5 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM11.7 11.7 20 20M16 16l2-2M18.5 18.5l2-2',
  lock: 'M7.5 10.5h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1zM9 10.5V8a3 3 0 0 1 6 0v2.5',
  monitor: 'M4.5 6h15v9h-15zM9.5 18.5h5M12 15v3.5',
  phone: 'M8 4.5h8a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zM11 17.5h2',
  // Hai glyph của dải stat trang Workspaces (ảnh Workspaces Overview, khung 1): 'Sở hữu' vẽ
  // MỘT người (quyền sở hữu là chuyện của cá nhân tôi), 'Được chia sẻ' vẽ ba nút nối nhau
  // (đúng glyph share trong ảnh). 'users' đã tồn tại nhưng là HAI người nên không dùng cho
  // 'Sở hữu' — hai thẻ cạnh nhau cùng một hình thì người đọc không phân biệt được bằng mắt.
  user: 'M12 11a3.6 3.6 0 1 0 0-7.2A3.6 3.6 0 0 0 12 11zM5.6 20a6.4 6.4 0 0 1 12.8 0',
  share: 'M6.5 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17.5 14a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6.5 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8.7 8.2 15.3 11.2M8.7 15.8 15.3 12.8',
  // Hai glyph của thanh module trang Project (ảnh DataVerse_Project_Workspace_Overview_v1):
  // 'chart' = ba cột biểu đồ của "Data View" (ảnh vẽ cột cao thấp, KHÔNG phải màn hình — 'monitor'
  // bản cũ nói sai "góc nhìn dữ liệu" thành một cái màn hình), 'alert' = tam giác chấm than của
  // "Detection" (ảnh vẽ dấu cảnh báo, không phải khiên — 'shield' đã mang nghĩa bảo mật trong
  // Settings, dùng lại sẽ biến "phát hiện vấn đề" thành "phòng thủ").
  chart: 'M4.5 19.5h15M7.5 19.5v-6.4M12 19.5V7.5M16.5 19.5v-9.6',
  alert: 'M12 4.4 21.2 19.6H2.8zM12 9.6v4.5M12 16.9h.01',
}

export function PreviewIcon({ name, label }: { name: string; label?: string }) {
  const d = paths[name] ?? paths.datasets
  return <svg className="preview-icon" viewBox="0 0 24 24" aria-hidden={label ? undefined : true}
    role={label ? 'img' : undefined} focusable="false" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {label ? <title>{label}</title> : null}
    <path d={d} />
  </svg>
}
