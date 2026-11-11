#!/usr/bin/env bash
set -euo pipefail

APK_PATH="${APK_PATH:-somai-1.9.7.apk}"
PACKAGE="br.com.denny.somai"
OUT_DIR="docs/capturas"
mkdir -p "$OUT_DIR"

adb wait-for-device
adb shell wm size 720x1600
adb shell wm density 320
adb shell settings put system screen_off_timeout 600000 || true
adb install -r "$APK_PATH"

# Captura de uma instalação limpa: sem dados pessoais, testes ou simulações.
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1
sleep 15
adb exec-out screencap -p > "$OUT_DIR/somai-inicio.png"

# Menu real do aplicativo na área superior direita do layout.
adb shell input tap 621 126
sleep 4
adb exec-out screencap -p > "$OUT_DIR/somai-menu-mais.png"

# Área inferior da tela inicial após uma rolagem real.
adb shell input keyevent 4 || true
sleep 2
adb shell input swipe 345 1320 345 535 650
sleep 3
adb exec-out screencap -p > "$OUT_DIR/somai-inicio-recursos.png"

python3 - <<'PY'
from pathlib import Path
import struct

folder = Path("docs/capturas")
for path in sorted(folder.glob("*.png")):
    data = path.read_bytes()
    if not data.startswith(b"\x89PNG\r\n\x1a\n") or len(data) < 10000:
        raise SystemExit(f"Captura PNG vazia/invalida: {path.name}")
    w, h = struct.unpack(">II", data[16:24])
    if w < 500 or h < 900:
        raise SystemExit(f"Dimensoes inesperadas: {path.name} ({w}x{h})")
    print(f"Captura real verificada: {path.name}, {w}x{h}, {len(data)} bytes")
PY
