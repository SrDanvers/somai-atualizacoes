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

adb root || true
adb wait-for-device
adb shell setprop persist.sys.locale pt-BR || true
adb shell stop || true
adb shell start || true
sleep 11
for attempt in $(seq 1 10); do
  adb shell pm list packages android | grep -q 'package:android' && break
  sleep 3
done
adb shell input keyevent 82 || true

media=content://media/external_primary/downloads
adb shell content insert --uri "$media" --bind "_display_name:s:$apk" --bind 'mime_type:s:application/vnd.android.package-archive' --bind 'relative_path:s:Download/' --bind 'is_pending:i:1' || true
id="$(adb shell content query --uri "$media" --projection _id:_display_name --where "is_pending=1" | grep -F "$apk" | sed -n 's/.*_id=\([0-9][0-9]*\),.*/\1/p' | head -n 1)" || true
if [[ -n "$id" ]]; then
  adb shell content write --uri "$media/$id" < "$apk"
  adb shell content update --uri "$media/$id" --bind is_pending:i:0
else
  adb shell mkdir -p /sdcard/Download
  adb push "$apk" "/sdcard/Download/$apk"
fi
adb shell ls -l /sdcard/Download
adb shell am start -W -a android.intent.action.VIEW_DOWNLOADS || adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.APP_FILES || true
sleep 3
dump downloads || true
if ! grep -Fq "$apk" "$out/downloads.xml"; then
  adb shell am start -W -a android.intent.action.VIEW -d 'content://com.android.externalstorage.documents/document/primary%3ADownload' -t 'vnd.android.document/directory' --grant-read-uri-permission || true
  sleep 3
  dump downloads || true
fi
capture downloads

if ! tap_text downloads "$apk"; then
  echo 'Abrindo pela URI do arquivo.'
  if [[ -n "$id" ]]; then
    adb shell am start -W -a android.intent.action.VIEW -d "$media/$id" -t application/vnd.android.package-archive --grant-read-uri-permission || true
  else
    adb shell am start -W -a android.intent.action.VIEW -d "content://com.android.externalstorage.documents/document/primary%3ADownload%2F$apk" -t application/vnd.android.package-archive --grant-read-uri-permission || true
  fi
fi
sleep 3
dump source || true
capture source
if tap_text source 'settings|configurações'; then
  sleep 3
  dump permission || true
  capture permission
  if tap_text permission 'allow from this source|permitir desta fonte|permitir dessa fonte'; then
    adb shell input keyevent 4
    sleep 3
  fi
fi
dump installer || true
capture installer
if tap_text installer 'install|instalar'; then
  sleep 5
  dump installed || true
  capture installed
fi

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
