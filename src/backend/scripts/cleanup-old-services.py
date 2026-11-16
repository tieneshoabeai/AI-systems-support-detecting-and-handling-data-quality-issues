#!/usr/bin/env python3
"""
Bước 5 (L1) — Dọn service cũ sau khi tách commands/queries.

1. Thay `XxxService` trong các file application còn lại (vd. `ai-worker.service.ts`)
   bằng handler tương ứng.
2. Xóa file `application/<module>.service.ts` đã được tách.
3. Cập nhật `index.ts` public contract của từng module.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / '.handler-manifest.json').read_text())

# Service KHÔNG thuộc phạm vi tách (giữ nguyên).
KEEP_SERVICES = {
    'realtime/realtime.service.ts',
    'realtime/realtime-auth.service.ts',
    'analysis/report-worker.service.ts',
}


def handler_by_service_method() -> dict[tuple[str, str], dict]:
    out = {}
    for mod, hs in MANIFEST.items():
        for h in hs:
            item = dict(h)
            item['module'] = mod
            out[(h['serviceName'], h['methodName'])] = item
    return out


HANDLERS = handler_by_service_method()


def module_of(rel: str) -> str:
    parts = rel.split('/')
    if len(parts) >= 3 and parts[0] == 'src' and parts[1] == 'modules':
        return parts[2]
    return parts[0]


def relative_import(from_file: pathlib.Path, to_file: pathlib.Path) -> str:
    rel = os_path_relpath(to_file, from_file.parent)
    if not rel.startswith('.'):
        rel = './' + rel
    return rel.replace('\\', '/')


def os_path_relpath(target: pathlib.Path, start: pathlib.Path) -> str:
    import os
    return os.path.relpath(str(target), str(start))


def process_app_file(f: pathlib.Path) -> bool:
    """Thay service bằng handler trong 1 file application/worker."""
    s = f.read_text()
    orig = s
    changed = False
    mod = module_of(str(f.relative_to(ROOT / 'src/modules')))

    for (svc, method), h in HANDLERS.items():
        if h['module'] != mod:
            continue
        # this.xxxService.method(  →  this.methodHandler.execute(
        pat = re.compile(
            r'this\.(\w*?)Service\s*\.\s*' + re.escape(method) + r'\s*\(',
            re.S,
        )
        if not pat.search(s):
            continue
        s = pat.sub(f'this.{method}Handler.execute(', s)
        changed = True

        # constructor param: private readonly xxxService: XxxService
        ctor_pat = re.compile(
            r'private readonly (\w+?)Service:\s*' + re.escape(svc) + r'\b',
        )
        if ctor_pat.search(s):
            handler_file = ROOT / 'src/modules' / mod / 'application' / h['rel']
            imp_path = relative_import(f, handler_file).removesuffix('.ts')
            s = ctor_pat.sub(
                f'private readonly {method}Handler: {h["className"]}', s
            )
            # xóa import service cũ, thêm import handler
            s = re.sub(
                r"^import \{ " + re.escape(svc) + r" \} from '[^']*';\n",
                '',
                s,
                flags=re.M,
            )
            imp_line = f"import {{ {h['className']} }} from '{imp_path}';"
            if imp_line not in s:
                # chèn sau import cuối
                last = None
                for m in re.finditer(r"^import [\s\S]*?from '[^']*';\n", s, re.M):
                    last = m
                if last:
                    s = s[: last.end()] + imp_line + '\n' + s[last.end():]
                else:
                    s = imp_line + '\n' + s
            changed = True

    if s != orig:
        f.write_text(s)
    return changed


def main() -> None:
    modules_dir = ROOT / 'src/modules'
    touched = []
    for f in sorted(modules_dir.rglob('*.ts')):
        if '/application/' not in str(f).replace('\\', '/'):
            continue
        if f.name.endswith('.handler.ts'):
            continue
        if process_app_file(f):
            touched.append(str(f.relative_to(ROOT)))
    print('Files application da doi:')
    for t in touched:
        print('  -', t)


if __name__ == '__main__':
    main()
