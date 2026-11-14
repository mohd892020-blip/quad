#!/usr/bin/env bash
# Starts the simulator build of the iPhone app on the newest simulator whose name matches $1, upright and then sideways,
# and keeps two screenshots and the page's log in shots/ as $2-upright.png, $2-sideways.png and $2-log.txt.
# Used by .github/workflows/ios.yml on the macOS runner.
set -uo pipefail
re="$1" name="$2"
APP=build/Build/Products/Debug-iphonesimulator/FlyingParcel.app
ID=com.flyingparcel.game
mkdir -p shots

# runs a command for at most $1 seconds (macOS has no timeout command)
limit() { local s="$1"; shift; perl -e 'alarm shift; exec @ARGV' "$s" "$@"; }
note() { echo "::notice title=$name::$*"; }

udid=$(xcrun simctl list devices available -j | jq -r --arg re "$re" \
  '[.devices | to_entries | sort_by(.key)[] | select(.key | test("iOS")) | .value[] | select(.name | test($re))] | last | .udid // empty')
if [ -z "$udid" ]; then
  note "no simulator matches $re"
  xcrun simctl list devices available | head -n 60
  exit 1
fi
note "using $(xcrun simctl list devices | grep "$udid" | sed 's/^ *//')"

limit 60 xcrun simctl boot "$udid" || true
limit 300 xcrun simctl bootstatus "$udid" -b >/dev/null || note "boot did not finish"
limit 120 xcrun simctl install "$udid" "$APP" || { note "install failed"; exit 1; }

limit 60 xcrun simctl launch "$udid" "$ID" || note "launch failed"
sleep 25
limit 60 xcrun simctl io "$udid" screenshot "shots/$name-upright.png" || note "upright screenshot failed"
limit 30 xcrun simctl terminate "$udid" "$ID" || true
sleep 3
limit 60 xcrun simctl launch "$udid" "$ID" -ForceSideways YES || note "sideways launch failed"
sleep 25
limit 60 xcrun simctl io "$udid" screenshot "shots/$name-sideways.png" || note "sideways screenshot failed"

limit 120 xcrun simctl spawn "$udid" log show --last 10m --style compact \
  --predicate 'subsystem == "com.flyingparcel.game" OR (process == "FlyingParcel" AND messageType == error)' \
  > "shots/$name-log.txt" || note "log read failed"
echo "----- $name log"
cat "shots/$name-log.txt"
grep -E 'page:|sideways|turn failed|error' "shots/$name-log.txt" | head -n 8 | while IFS= read -r line; do note "${line:0:300}"; done
limit 60 xcrun simctl shutdown "$udid" || true
