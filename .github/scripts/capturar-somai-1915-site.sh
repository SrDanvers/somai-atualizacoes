#!/usr/bin/env bash
set -euo pipefail

package=br.com.denny.somai
out=capturas-site
apk=Somai-1.9.15.apk

adb shell wm size 720x1600
adb shell wm density 320
adb shell settings put system screen_off_timeout 1200000
adb shell settings put global hide_error_dialogs 1
adb shell input keyevent 82

capture() {
  adb exec-out screencap -p > "$out/$1.png"
}

dump() {
  local name=$1
  adb shell rm -f /sdcard/somai-capture.xml
  timeout 15s adb shell uiautomator dump /sdcard/somai-capture.xml >/dev/null 2>&1 || return
  adb exec-out cat /sdcard/somai-capture.xml > "$out/$name.xml"
}

tap_text() {
  local coords
  coords="$(python3 - "$out/$1.xml" "$2" <<'PY'
import re
import sys
from xml.etree import ElementTree as ET

document, labels = sys.argv[1:]
try:
    root = ET.parse(document).getroot()
except (OSError, ET.ParseError):
    raise SystemExit(1)
for label in labels.casefold().split('|'):
    nodes = list(root.iter('node'))
    for node in nodes:
        text = node.get('text', '').casefold().strip()
        description = node.get('content-desc', '').casefold().strip()
        if label not in (text, description):
            continue
        coordinates = re.findall(r'\d+', node.get('bounds', ''))
        if len(coordinates) == 4:
            x1, y1, x2, y2 = map(int, coordinates)
            if x2 > x1 and y2 > y1:
                print((x1 + x2) // 2, (y1 + y2) // 2)
                raise SystemExit(0)
raise SystemExit(1)
PY
)" || return
  read -r x y <<< "$coords"
  adb shell input tap "$x" "$y"
}

adb shell mkdir -p /sdcard/Download
adb push "$apk" "/sdcard/Download/$apk"
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file:///sdcard/Download/$apk" >/dev/null || true
adb shell am start -a android.intent.action.VIEW_DOWNLOADS >/dev/null 2>&1 || adb shell am start -a android.intent.action.MAIN -c android.intent.category.APP_FILES >/dev/null 2>&1 || true
sleep 3
dump downloads || true
capture downloads

if ! tap_text downloads "$apk"; then
  adb shell am start -a android.intent.action.VIEW -d "file:///sdcard/Download/$apk" -t application/vnd.android.package-archive >/dev/null 2>&1 || true
fi
sleep 3
dump source || true
capture source
if tap_text source 'settings|configurações'; then
  sleep 3
  dump permission || true
  capture permission
  if tap_text permission 'allow from this source|permitir desta fonte'; then
    adb shell input keyevent 4
    sleep 3
  fi
fi
dump installer || true
capture installer

adb install -r "$apk"
adb shell pm clear "$package"
adb shell dumpsys package "$package" | grep -E 'versionName=|versionCode=' > "$out/versao.txt"
grep -q 'versionName=1.9.15' "$out/versao.txt"
grep -q 'versionCode=30' "$out/versao.txt"
adb shell am start -W -n "$package/.MainActivity"
sleep 9
dump app-inicio
grep -q "$package" "$out/app-inicio.xml"
grep -qi 'Escanear' "$out/app-inicio.xml"
capture app-inicio

if tap_text app-inicio 'Adicionar item'; then
  sleep 2
  dump app-adicionar || true
  capture app-adicionar
fi
adb shell am force-stop "$package"
adb shell am start -W -n "$package/.MainActivity"
sleep 3
dump home-again
if ! tap_text home-again 'Mais|Mais opções|Menu Mais'; then
  adb shell input tap 620 151
fi
sleep 3
dump app-menu || true
capture app-menu

if tap_text app-menu 'Comparar embalagens'; then
  sleep 2
  dump app-comparar || true
  capture app-comparar
fi
adb shell am force-stop "$package"
adb shell am start -W -n "$package/.MainActivity"
sleep 3
adb shell input swipe 345 1320 345 555 620
sleep 2
dump app-recursos || true
capture app-recursos

python3 - <<'PY'
from pathlib import Path
import struct

folder = Path('capturas-site')
for name in ('app-inicio', 'app-menu'):
    data = (folder / f'{name}.png').read_bytes()
    assert data.startswith(b'\x89PNG\r\n\x1a\n') and struct.unpack('>II', data[16:24]) == (720, 1600), name
print('Arquivos de conferência coletados.')
PY
