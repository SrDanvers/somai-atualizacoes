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

# Usar a activity do Somaí diretamente. Não depende do Pixel Launcher.
adb shell am force-stop com.google.android.apps.nexuslauncher || true
adb shell am start -W -n "$PACKAGE/.MainActivity"
sleep 10

read_ui() {
  timeout 22s adb shell uiautomator dump /sdcard/somai-ui.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/somai-ui.xml 2>/dev/null > /tmp/somai-ui.xml || true
}

dismiss_android_errors() {
  local attempt
  for attempt in 1 2 3 4 5; do
    read_ui
    if ! grep -Eiq "(isn.t responding|not responding|Pixel Launcher isn)" /tmp/somai-ui.xml 2>/dev/null; then
      return 0
    fi
    echo "Aviso do launcher detectado. Tentativa $attempt de fechar a janela do Android." >&2
    local coords
    coords="$(python3 - <<'PY'
import re
from xml.etree import ElementTree as ET
try:
    root=ET.parse('/tmp/somai-ui.xml').getroot()
    for node in root.iter('node'):
        label=(node.get('text','')+' '+node.get('content-desc','')).lower()
        if 'close app' in label or 'fechar app' in label:
            m=re.search(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',node.get('bounds',''))
            if m:
                x1,y1,x2,y2=map(int,m.groups())
                print(f'{(x1+x2)//2} {(y1+y2)//2}')
                break
except Exception as exc:
    print('',end='')
PY
)"
    if [ -n "$coords" ]; then
      adb shell input tap $coords
    else
      adb shell input keyevent 4 || true
    fi
    sleep 5
    adb shell am start -W -n "$PACKAGE/.MainActivity" >/dev/null || true
    sleep 3
  done
  read_ui
  if grep -Eiq "(isn.t responding|not responding)" /tmp/somai-ui.xml 2>/dev/null; then
    echo "Nao foi possivel remover erro do Android. Nenhuma captura sera publicada." >&2
    exit 1
  fi
}

capture() {
  local name="$1"
  dismiss_android_errors
  sleep 2
  adb exec-out screencap -p > "$OUT_DIR/$name.png"
}

capture "somai-inicio"

# Abrir o menu Mais e fotografar a interface real.
adb shell input tap 620 151
sleep 5
capture "somai-menu-mais"

# Fechar Mais e rolar a tela para mostrar os demais recursos.
adb shell input keyevent 4 || true
sleep 3
adb shell input swipe 345 1320 345 535 650
sleep 5
capture "somai-inicio-recursos"

python3 - <<'PY'
from pathlib import Path
import hashlib
import struct

folder=Path('docs/capturas')
paths=[folder/'somai-inicio.png',folder/'somai-menu-mais.png',folder/'somai-inicio-recursos.png']
hashes=[]
for path in paths:
    data=path.read_bytes()
    if not data.startswith(b'\x89PNG\r\n\x1a\n') or len(data)<12000:
        raise SystemExit(f'Captura vazia ou invalida: {path.name}')
    w,h=struct.unpack('>II',data[16:24])
    if w<500 or h<900:
        raise SystemExit(f'Dimensoes inesperadas: {path.name} ({w}x{h})')
    hashes.append(hashlib.sha256(data).hexdigest())
    print(f'Captura conferida: {path.name}: {w}x{h}, {len(data)} bytes')
if len(set(hashes)) != len(hashes):
    raise SystemExit('As capturas sao identicas: possivel popup do emulador. Imagens rejeitadas.')
PY
