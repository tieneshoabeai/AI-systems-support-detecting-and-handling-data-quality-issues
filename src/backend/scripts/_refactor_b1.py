#!/usr/bin/env python3
"""
BƯỚC 1 — codemod tái cấu trúc thư mục theo Clean Architecture.

Di chuyển file + tự động tính lại MỌI đường dẫn import tương đối:
  1. Resolve import trên cây CŨ (trước khi di chuyển).
  2. Ánh xạ vị trí cũ -> vị trí mới.
  3. Tính lại đường dẫn tương đối từ vị trí MỚI của file nhập tới vị trí MỚI
     của file đích.

Không thay đổi bất kỳ logic nào — chỉ di chuyển file + sửa đường dẫn.

Cách dùng:
    python3 scripts/_refactor_b1.py --scope shared [--dry-run]
    python3 scripts/_refactor_b1.py --scope modules [--dry-run]
"""

import os
import re
import sys
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
TEST = os.path.join(ROOT, "test")
SCRIPTS = os.path.join(ROOT, "scripts")

# ── 1. Ánh xạ di chuyển thư mục `shared/` ───────────────────────────────
SHARED_DIR_MOVES = [
    ("shared/crypto", "shared/domain/crypto"),
    ("shared/pagination", "shared/domain/pagination"),
    ("shared/utils", "shared/domain/utils"),
    ("shared/validation", "shared/domain/validation"),
    ("shared/ports", "shared/application/ports"),
    ("shared/application/outbox", "shared/infrastructure/outbox"),
    ("shared/database", "shared/infrastructure/database"),
    ("shared/events", "shared/infrastructure/events"),
    ("shared/storage", "shared/infrastructure/storage"),
    ("shared/adapters", "shared/infrastructure/adapters"),
    ("shared/config", "shared/infrastructure/config"),
    ("shared/casl", "shared/interfaces/casl"),
    ("shared/decorators", "shared/interfaces/decorators"),
    ("shared/filters", "shared/interfaces/filters"),
    ("shared/guards", "shared/interfaces/guards"),
    ("shared/interceptors", "shared/interfaces/interceptors"),
    ("shared/middleware", "shared/interfaces/middleware"),
    ("shared/pipes", "shared/interfaces/pipes"),
    ("shared/swagger", "shared/interfaces/swagger"),
]

# File đơn lẻ trong shared/ được chuyển sang tầng domain (tách type thuần
# ra khỏi framework — xem Phần 16 §3.4).
SHARED_FILE_MOVES = [
    ("shared/casl/actions.enum.ts", "shared/domain/security/action.ts"),
    ("shared/casl/subjects.type.ts", "shared/domain/security/subjects.ts"),
]

# ── 2. Regex parse import ────────────────────────────────────────────────
SPEC_RE = re.compile(
    r"""(?P<pre>(?:import|export)\s+(?:type\s+)?[^;'"]*?from\s*['"])(?P<spec>[^'"]+)(?P<post>['"])""",
    re.S,
)
BARE_RE = re.compile(r"""(?P<pre>import\s*['"])(?P<spec>[^'"]+)(?P<post>['"])""")


def all_ts_files():
    out = []
    for base in (SRC, TEST, SCRIPTS):
        if not os.path.isdir(base):
            continue
        for dirpath, _dirnames, filenames in os.walk(base):
            if "node_modules" in dirpath:
                continue
            for f in filenames:
                if f.endswith(".ts") and not f.endswith(".d.ts"):
                    out.append(os.path.join(dirpath, f))
    return sorted(out)


def resolve_spec(importer_abs, spec):
    """Resolve một specifier tương đối thành đường dẫn tuyệt đối (file)."""
    base = os.path.normpath(os.path.join(os.path.dirname(importer_abs), spec))
    for c in (base, base + ".ts", base + ".tsx", os.path.join(base, "index.ts")):
        if os.path.isfile(c):
            return c
    return None


def compute_move_map(scope):
    moves = {}

    if scope == "shared":
        for old_rel, new_rel in SHARED_DIR_MOVES:
            old_abs = os.path.join(SRC, old_rel)
            if not os.path.isdir(old_abs):
                print(f"  [skip] không tồn tại: {old_rel}")
                continue
            for dirpath, _d, files in os.walk(old_abs):
                for f in files:
                    if not f.endswith(".ts"):
                        continue
                    o = os.path.join(dirpath, f)
                    rel = os.path.relpath(o, old_abs)
                    moves[o] = os.path.join(SRC, new_rel, rel)

        for old_rel, new_rel in SHARED_FILE_MOVES:
            o = os.path.join(SRC, old_rel)
            if os.path.isfile(o):
                moves[o] = os.path.join(SRC, new_rel)

    elif scope == "modules":
        modules_dir = os.path.join(SRC, "modules")
        for m in sorted(os.listdir(modules_dir)):
            mdir = os.path.join(modules_dir, m)
            if not os.path.isdir(mdir):
                continue
            # infrastructure/http/*.controller.ts -> presentation/controllers/
            http_dir = os.path.join(mdir, "infrastructure", "http")
            if os.path.isdir(http_dir):
                for f in sorted(os.listdir(http_dir)):
                    o = os.path.join(http_dir, f)
                    if f.endswith(".controller.ts"):
                        moves[o] = os.path.join(mdir, "presentation", "controllers", f)
                    elif f == "dtos" and os.path.isdir(o):
                        for df in sorted(os.listdir(o)):
                            if df.endswith(".ts"):
                                moves[os.path.join(o, df)] = os.path.join(
                                    mdir, "presentation", "dtos", df
                                )
            # infrastructure/adapters/*policy.loader.ts -> application/policy-loaders/
            adapters_dir = os.path.join(mdir, "infrastructure", "adapters")
            if os.path.isdir(adapters_dir):
                for f in sorted(os.listdir(adapters_dir)):
                    if f.endswith("policy.loader.ts"):
                        moves[os.path.join(adapters_dir, f)] = os.path.join(
                            mdir, "application", "policy-loaders", f
                        )
        # realtime gateway -> presentation/gateways/
        gw = os.path.join(SRC, "modules/realtime/infrastructure/websocket/realtime.gateway.ts")
        if os.path.isfile(gw):
            moves[gw] = os.path.join(
                SRC, "modules/realtime/presentation/gateways/realtime.gateway.ts"
            )

    else:
        raise SystemExit(f"scope không hợp lệ: {scope}")

    return moves


def rel_spec(new_importer_abs, new_target_abs):
    """Specifier tương đối từ vị trí mới của importer tới vị trí mới của target."""
    if os.path.basename(new_target_abs) == "index.ts":
        spec = os.path.relpath(os.path.dirname(new_target_abs), os.path.dirname(new_importer_abs))
    else:
        spec = os.path.relpath(new_target_abs, os.path.dirname(new_importer_abs))
    spec = spec.replace(os.sep, "/")
    # Bỏ đuôi `.ts` — import trong TS dùng đường dẫn không phần mở rộng.
    if spec.endswith(".ts"):
        spec = spec[: -len(".ts")]
    if not spec.startswith("."):
        spec = "./" + spec
    return spec


def main():
    args = sys.argv[1:]
    scope = "shared"
    if "--scope" in args:
        scope = args[args.index("--scope") + 1]
    dry = "--dry-run" in args

    files = all_ts_files()
    moves = compute_move_map(scope)
    print(f"[1] scope={scope} · file .ts quét: {len(files)} · file di chuyển: {len(moves)}")

    if dry:
        for old, new in sorted(moves.items()):
            print(f"  MOVE {os.path.relpath(old, ROOT)}\n    -> {os.path.relpath(new, ROOT)}")
        return

    # ── Phase A: ghi nhận import gốc (trên cây CŨ) ───────────────────────
    original_imports = {}
    for f in files:
        with open(f, "r", encoding="utf-8") as fh:
            content = fh.read()
        pairs = []
        for rx in (SPEC_RE, BARE_RE):
            for m in rx.finditer(content):
                spec = m.group("spec")
                if not spec.startswith("."):
                    continue
                pairs.append((rx, m.group("pre"), spec, m.group("post"), resolve_spec(f, spec)))
        original_imports[f] = (content, pairs)

    # ── Phase B: di chuyển file ─────────────────────────────────────────
    for old, new in sorted(moves.items()):
        os.makedirs(os.path.dirname(new), exist_ok=True)
        if os.path.isfile(new):
            # đích đã tồn tại (ví dụ file type thuần đã được tách thủ công) →
            # chỉ xoá nguồn, giữ nội dung đích.
            os.remove(old)
        else:
            shutil.move(old, new)
    # dọn thư mục rỗng
    for dirpath, dirnames, filenames in os.walk(SRC, topdown=False):
        if not dirnames and not filenames:
            try:
                os.rmdir(dirpath)
            except OSError:
                pass

    # ── Phase C: viết lại import ────────────────────────────────────────
    changed = 0
    for old_abs, (content, pairs) in original_imports.items():
        new_abs = moves.get(old_abs, old_abs)
        if not os.path.isfile(new_abs):
            continue

        # Tính bảng thay thế: (start, end, new_spec) theo vị trí trong content gốc
        replacements = []
        for _rx, _pre, spec, _post, tgt in pairs:
            if tgt is None:
                continue
            new_tgt = moves.get(tgt, tgt)
            if new_tgt == tgt and new_abs == old_abs:
                continue  # không có gì thay đổi
            replacements.append((spec, rel_spec(new_abs, new_tgt)))

        if not replacements:
            continue

        # Thay theo thứ tự xuất hiện, không chồng lấn (dùng regex \G quét tuần tự)
        out = []
        idx = 0
        changed_content = content
        for rx in (SPEC_RE, BARE_RE):
            def repl(m, _rx=rx):
                spec = m.group("spec")
                if not spec.startswith("."):
                    return m.group(0)
                for old_spec, new_spec in replacements:
                    if old_spec == spec:
                        return m.group("pre") + new_spec + m.group("post")
                return m.group(0)
            changed_content = rx.sub(repl, changed_content)

        if changed_content != content:
            with open(new_abs, "w", encoding="utf-8") as fh:
                fh.write(changed_content)
            changed += 1

    print(f"[2] file có import được viết lại: {changed}")
    print("[OK] Hoàn tất.")


if __name__ == "__main__":
    main()
