#!/usr/bin/env python3
"""
Cập nhật unit test sau khi tách service → handlers (Command/Query pattern).

Gồm 2 nhóm thay đổi:

A. Port facade (Bước 4): test mock service chéo module bằng `provide: XxxService`
   → phải đổi sang token port tương ứng:
     ProjectsService   → PROJECT_ACCESS_PORT   (modules/projects)
     WorkspacesService → WORKSPACE_ACCESS_PORT (modules/workspaces)
     UsersService      → USER_REPOSITORY_PORT  (modules/users)
     AuditService      → AUDIT_LOGGER_PORT     (modules/audit)

B. Command/Query pattern (Bước 5): service → handler
   - `import { XxxService } from '.../xxx.service'` → import map handler
   - providers: `XxxService,`                     → `...Object.values(xxxHandlers),`
   - `module.get<XxxService>(XxxService)`         → `createHandlerProxy(module, xxxHandlers)`
   - type: `let service: XxxService`              → `ProxyOf<typeof xxxHandlers>`

Script idempotent — chạy lại nhiều lần cho cùng kết quả.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / '.handler-manifest.json').read_text())

# ── A. Port facade ───────────────────────────────────────────────────────────
PORT_FACADE = {
    'ProjectsService': ('PROJECT_ACCESS_PORT', '../src/modules/projects'),
    'WorkspacesService': ('WORKSPACE_ACCESS_PORT', '../src/modules/workspaces'),
    'UsersService': ('USER_REPOSITORY_PORT', '../src/modules/users'),
    'AuditService': ('AUDIT_LOGGER_PORT', '../src/modules/audit'),
}

# ── B. Command/Query ─────────────────────────────────────────────────────────
MODULE_SERVICE = {
    'analysis': 'AnalysisService',
    'audit': 'AuditService',
    'auth': 'AuthService',
    'data-view': 'DataViewService',
    'datasets': 'DatasetsService',
    'feedback': 'FeedbackService',
    'issues': 'IssuesService',
    'notifications': 'NotificationsService',
    'overview': 'OverviewService',
    'projects': 'ProjectsService',
    'users': 'UsersService',
    'workspaces': 'WorkspacesService',
}

HANDLER_MODULES = set(MANIFEST.keys())


def handler_var(mod: str) -> str:
    return mod.replace('-', '') + 'Handlers'


def dedupe_imports(lines: list[str]) -> list[str]:
    """Bỏ import trùng — CHỈ với import 1 dòng (kết thúc bằng `';'`).

    Import nhiều dòng bắt đầu bằng `import {` và kết thúc ở dòng `} from '...'`,
    nên không được so sánh theo từng dòng.
    """
    seen = set()
    out = []
    for ln in lines:
        st = ln.strip()
        if st.startswith('import ') and st.endswith("';"):
            if st in seen:
                continue
            seen.add(st)
        out.append(ln)
    return out


def insert_import(lines: list[str], imp: str) -> list[str]:
    if imp in lines:
        return lines
    idx = 0
    for i, ln in enumerate(lines):
        if ln.startswith('import '):
            idx = i + 1
    lines.insert(idx, imp)
    return lines


def apply_port_facade(lines: list[str]) -> list[str]:
    """Đổi `provide: XxxService` → `provide: <PORT>` + thêm import token."""
    for svc, (port, mod_path) in PORT_FACADE.items():
        changed = False
        for i, ln in enumerate(lines):
            st = ln.strip()
            if st.startswith('{ provide: ' + svc + ','):
                lines[i] = ln.replace('{ provide: ' + svc + ',', '{ provide: ' + port + ',')
                changed = True
            elif st.startswith('{ provide: ' + svc + ' }'):
                lines[i] = ln.replace('{ provide: ' + svc + ' }', '{ provide: ' + port + ' }')
                changed = True
            elif st == 'provide: ' + svc + ',':
                indent = ln[: len(ln) - len(ln.lstrip())]
                lines[i] = f'{indent}provide: {port},'
                changed = True
        if changed:
            lines = insert_import(
                lines, f"import {{ {port} }} from '{mod_path}';"
            )
            # bỏ import service cũ (nếu có)
            lines = [
                ln
                for ln in lines
                if not (
                    ln.strip().startswith(f'import {{ {svc} }} ')
                    and 'application/' in ln
                    and '.service' in ln
                )
            ]
    return lines


def apply_handlers(lines: list[str], mod: str, svc: str) -> list[str]:
    hvar = handler_var(mod)

    # 1) import service → import map handler + helper
    has_service_import = any(
        ln.strip().startswith(f'import {{ {svc} }} ')
        and 'application/' in ln
        and '.service' in ln
        for ln in lines
    )
    if not has_service_import:
        return lines
    lines = [
        ln
        for ln in lines
        if not (
            ln.strip().startswith(f'import {{ {svc} }} ')
            and 'application/' in ln
            and '.service' in ln
        )
    ]
    lines = insert_import(
        lines, "import { createHandlerProxy, type ProxyOf } from './helpers/handler-proxy';"
    )
    lines = insert_import(
        lines, f"import {{ {hvar} }} from './helpers/module-handlers';"
    )

    out = []
    for ln in lines:
        st = ln.strip()
        # stub rỗng `{ provide: XxxService, useValue: {} }` → bỏ hẳn
        if st.startswith('{ provide: ' + svc + ', useValue: {}') :
            continue
        # provider dạng `XxxService,` → `...Object.values(xxxHandlers),`
        if st == svc + ',':
            indent = ln[: len(ln) - len(ln.lstrip())]
            out.append(f'{indent}...Object.values({hvar}),')
            continue
        # provider inline `providers: [XxxService, ...]`
        if st.startswith('providers: [') and svc + ',' in st:
            out.append(ln.replace(svc + ',', f'...Object.values({hvar}),'))
            continue
        # `xxx.get<XxxService>(XxxService)` — tổng quát cho mọi tên biến giữ module
        m = re.search(r"(\w+)\.get<" + re.escape(svc) + r">\(\s*" + re.escape(svc) + r"\s*\)", ln)
        if m:
            ln = ln.replace(m.group(0), f'createHandlerProxy({m.group(1)}, {hvar})')
        out.append(ln)
    lines = out

    # type annotation
    lines = [
        re.sub(
            r'(?<![.\w])' + re.escape(svc) + r'(?=\s*[;,)=])',
            f'ProxyOf<typeof {hvar}>',
            ln,
        )
        if not ln.strip().startswith('import ') and not ln.strip().startswith('//')
        else ln
        for ln in lines
    ]
    return lines


def update_test(path: pathlib.Path) -> bool:
    s = orig = path.read_text()
    lines = s.split('\n')

    lines = apply_port_facade(lines)

    for mod, svc in MODULE_SERVICE.items():
        if mod not in HANDLER_MODULES:
            continue
        lines = apply_handlers(lines, mod, svc)

    # Đường dẫn đã đổi ở Bước 4 (L2): `record-query.port` thuộc module `datasets`.
    # Dọn import map handler không dùng trong file.
    for mod in HANDLER_MODULES:
        hvar = handler_var(mod)
        imp = f"import {{ {hvar} }} from './helpers/module-handlers';"
        if imp not in lines:
            continue
        used = any(hvar in ln for ln in lines if ln.strip() != imp)
        if not used:
            lines = [ln for ln in lines if ln != imp]

    s = '\n'.join(dedupe_imports(lines))
    s = s.replace(
        "from '../src/modules/data-view/domain/ports/record-query.port'",
        "from '../src/modules/datasets/domain/ports/record-query.port'",
    )
    s = s.replace(
        "from '../src/modules/realtime/domain/ports/realtime.port'",
        "from '../src/shared/ports/realtime.port'",
    )
    s = s.replace(
        "from '../src/modules/realtime/domain/realtime-events'",
        "from '../src/modules/realtime/domain/realtime-events'",
    )

    if s != orig:
        path.write_text(s)
        return True
    return False


def main() -> None:
    tdir = ROOT / 'test'
    changed = []
    for f in sorted(tdir.glob('*.spec.ts')):
        if update_test(f):
            changed.append(f.name)
    print('Test files updated:')
    for c in changed:
        print('  -', c)


if __name__ == '__main__':
    main()
