#!/usr/bin/env python3
"""Sinh `test/helpers/module-handlers.ts` — map method → HandlerClass cho từng module."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / '.handler-manifest.json').read_text())


def alias(mod: str, cls: str) -> str:
    """Đặt tiền tố module để tránh trùng tên class giữa các module."""
    prefix = ''.join(p.capitalize() for p in mod.split('-'))
    return f'{prefix}{cls}'


LINES = [
    '/**',
    ' * Auto-generated — xem `scripts/generate-test-handlers.py`.',
    ' *',
    ' * Map: tên method (như service cũ) → Handler class tương ứng,',
    ' * dùng cho unit test khi service đã được tách theo Command/Query pattern.',
    ' *',
    ' * Tên class được alias theo module để tránh trùng giữa các module',
    " * (vd. `RevokeSessionHandler` tồn tại ở cả `auth` và `users`).",
    ' */',
    '',
]

for mod, hs in MANIFEST.items():
    name = mod.replace('-', '') + 'Handlers'
    LINES.append('// ' + '-' * 20 + f' {mod} ' + '-' * 20)
    for h in sorted(hs, key=lambda x: x['methodName']):
        a = alias(mod, h['className'])
        LINES.append(
            f"import {{ {h['className']} as {a} }} "
            f"from '../../src/modules/{mod}/application/{h['rel'].replace('.ts', '')}';"
        )
    LINES.append('')
    LINES.append(f'export const {name} = {{')
    for h in sorted(hs, key=lambda x: x['methodName']):
        LINES.append(f"  {h['methodName']}: {alias(mod, h['className'])},")
    LINES.append('} as const;')
    LINES.append('')

out = ROOT / 'test/helpers/module-handlers.ts'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text('\n'.join(LINES), encoding='utf-8')
print('WROTE', out)
