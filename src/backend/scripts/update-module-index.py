#!/usr/bin/env python3
"""Cập nhật `index.ts` public contract — export các handler commands/queries của module."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / '.handler-manifest.json').read_text())

HEADER = """/**
 * Public contract của module {UPPER}.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
 */"""


def main() -> None:
    for mod, hs in MANIFEST.items():
        p = ROOT / 'src/modules' / mod / 'index.ts'
        if not p.exists():
            print('SKIP (khong co index.ts):', mod)
            continue
        s = p.read_text()
        # Xóa export service cũ nếu còn.
        import re
        s = re.sub(
            r"export \{ \w+Service \} from '\./application/[\w-]+\.service';\n",
            '',
            s,
        )
        # Gom handler theo nhóm.
        cmds = sorted((h for h in hs if h['rel'].startswith('commands/')), key=lambda x: x['className'])
        queries = sorted((h for h in hs if h['rel'].startswith('queries/')), key=lambda x: x['className'])
        blocks = []
        if queries:
            lines = [
                f"export {{ {h['className']} }} from './application/{h['rel'].replace('.ts', '')}';"
                for h in queries
            ]
            blocks.append('// ── Queries (đọc) ──────────────────────────────────────────────\n' + '\n'.join(lines))
        if cmds:
            lines = [
                f"export {{ {h['className']} }} from './application/{h['rel'].replace('.ts', '')}';"
                for h in cmds
            ]
            blocks.append('// ── Commands (ghi) ─────────────────────────────────────────────\n' + '\n'.join(lines))
        if not blocks:
            continue
        # Chèn vào cuối file, tránh trùng lặp.
        marker = '// ── Handlers (Command/Query) '
        if marker in s:
            s = s[: s.index(marker)].rstrip() + '\n'
        s = s.rstrip() + '\n\n' + marker + '──────────────────────────\n' + '\n\n'.join(blocks) + '\n'
        p.write_text(s)
        print('OK', mod, f'({len(cmds)} commands, {len(queries)} queries)')


if __name__ == '__main__':
    main()
