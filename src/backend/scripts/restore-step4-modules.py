#!/usr/bin/env python3
"""Khôi phục trạng thái module/controller sau Bước 4 (L2 + L3a + L4) từ transcript."""
import json, pathlib, re, subprocess, sys

TRANSCRIPT = '/home/hoa/.cursor/projects/home-hoa-Documents-UTH-L-p-tr-nh-JS-TS-AI-systems-support-detecting-and-handling-data-quality-issues/agent-transcripts/2897e56c-9482-419f-95a5-a52957a62d17/2897e56c-9482-419f-95a5-a52957a62d17.jsonl'
ROOT = pathlib.Path(__file__).resolve().parent.parent

# 1) Ghi lại 7 module files ở trạng thái Bước 4 (từ transcript).
MODULE_WRITES = {
    4649: 'src/modules/realtime/realtime.module.ts',
    4664: 'src/modules/datasets/datasets.module.ts',
    4665: 'src/modules/data-view/data-view.module.ts',
    4666: 'src/modules/projects/projects.module.ts',
    4667: 'src/modules/workspaces/workspaces.module.ts',
    4668: 'src/modules/audit/audit.module.ts',
    4670: 'src/modules/analysis/analysis.module.ts',
}

lines = open(TRANSCRIPT, encoding='utf-8').read().split('\n')
for lineno, rel in MODULE_WRITES.items():
    d = json.loads(lines[lineno])
    for x in d['message']['content']:
        if x.get('type') == 'tool_use' and x.get('name') == 'Write':
            p = ROOT / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(x['input']['contents'], encoding='utf-8')
            print('WROTE', rel)

# 2) Bind adapter cho facade ports (thay useExisting: XxxService).
specs = [
    ('src/modules/projects/projects.module.ts', 'ProjectsService', 'ProjectAccessAdapter', 'PROJECT_ACCESS_PORT',
     "import { ProjectAccessAdapter } from './infrastructure/adapters/project-access.adapter';"),
    ('src/modules/workspaces/workspaces.module.ts', 'WorkspacesService', 'WorkspaceAccessAdapter', 'WORKSPACE_ACCESS_PORT',
     "import { WorkspaceAccessAdapter } from './infrastructure/adapters/workspace-access.adapter';"),
    ('src/modules/audit/audit.module.ts', 'AuditService', 'AuditLoggerAdapter', 'AUDIT_LOGGER_PORT',
     "import { AuditLoggerAdapter } from './infrastructure/adapters/audit-logger.adapter';"),
]
for f, svc, adapter, port, imp in specs:
    p = ROOT / f
    s = p.read_text()
    s = s.replace(f'{{ provide: {port}, useExisting: {svc} }}',
                  f'{{ provide: {port}, useExisting: {adapter} }}')
    s = re.sub(rf'(\n(\s*)\{{ provide: {port}, useExisting: {adapter} \}})',
               rf'\n\2{adapter},\1', s, count=1)
    if imp not in s:
        # Chèn import vào cuối khối import (sau dòng import cuối cùng), KHÔNG chèn
        # trước decorator `@Global()` / `@Module(`.
        import_re = re.compile(r"^import [\s\S]*?from '[^']*';\n", re.M)
        last = None
        for m in import_re.finditer(s):
            last = m
        if last:
            end = last.end()
            s = s[:end] + imp + '\n' + s[end:]
        else:
            s = imp + '\n' + s
    p.write_text(s)
    print('BOUND', f, port, '->', adapter)

# 3) Vá AUDIT_LOGGER_PORT cho 3 controller.
ctrl_files = [
    'src/modules/analysis/infrastructure/http/report.controller.ts',
    'src/modules/datasets/infrastructure/http/datasets.controller.ts',
    'src/modules/issues/infrastructure/http/issues.controller.ts',
]
for rel in ctrl_files:
    p = ROOT / rel
    s = p.read_text()
    orig = s
    s = s.replace("import { AuditService } from '../../../audit/application/audit.service';",
                  "import { AUDIT_LOGGER_PORT, type AuditLoggerPort } from '../../../audit';")
    s = s.replace("    private readonly audit: AuditService,",
                  "    @Inject(AUDIT_LOGGER_PORT)\n    private readonly audit: AuditLoggerPort,")
    if '@Inject(AUDIT_LOGGER_PORT)' in s and 'Inject,' not in s.split("from '@nestjs/common'")[0]:
        s = s.replace("import { Controller,", "import { Inject, Controller,", 1)
        if 'Inject,' not in s.split("from '@nestjs/common'")[0]:
            s = s.replace("import {\n  Controller,", "import {\n  Inject,\n  Controller,", 1)
    p.write_text(s)
    print('PATCHED', rel, 'changed' if s != orig else 'UNCHANGED')

# 4) Dọn import trùng ở app.module.ts.
p = ROOT / 'src/app.module.ts'
if p.exists():
    seen = set(); out = []
    for ln in p.read_text().split('\n'):
        key = ln.strip()
        if key.startswith('import ') and key in seen:
            print('DUP removed:', key); continue
        if key.startswith('import '): seen.add(key)
        out.append(ln)
    p.write_text('\n'.join(out))

print('Xong')
