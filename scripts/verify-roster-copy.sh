#!/bin/bash
# E2E verification of the "Copy roster from previous series" feature.
# Creates two scratch teams, seeds 3 players on A, copies A -> B via
# POST /api/players/copy, checks idempotency + auth + copy-sources output,
# then deletes both scratch teams (cascade removes their players).
BASE=http://localhost:3000
J=/tmp/verify-roster
mkdir -p "$J"

echo "== 1. GET /api/players/copy-sources (public) =="
curl -s "$BASE/api/players/copy-sources" > "$J/sources.json"
python3 - <<'EOF'
import json
d = json.load(open('/tmp/verify-roster/sources.json'))
srcs = d.get("sources", [])
for s in srcs:
    teams = ", ".join(f"{t['name']}({t['playerCount']})" for t in s["teams"])
    print(f'  series: {s["name"]} [{s["season"]}] -> {teams}')
if not srcs:
    print("  WARNING: no sources yet (no team has players) — UI would show empty state")
EOF

echo "== 2. login site admin =="
curl -s -c "$J/cookies.txt" -H 'Content-Type: application/json' \
  -d '{"email":"admin@usacricketers.test","password":"admin123"}' \
  "$BASE/api/admin/login" > "$J/login.json"
python3 -c "import json;d=json.load(open('$J/login.json'));print('  login keys:', list(d.keys()))"
CSRF=$(awk '/csrf-token/{print $NF; exit}' "$J/cookies.txt")
echo "  csrf token: ${CSRF:0:8}…"

echo "== 3. create scratch teams A & B =="
mk() {
  curl -s -b "$J/cookies.txt" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
    -d "{\"name\":\"$1\",\"shortName\":\"$2\",\"country\":\"Test\"}" \
    "$BASE/api/teams" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['id'])"
}
A=$(mk "ZZ Copy Test A" "ZCA")
B=$(mk "ZZ Copy Test B" "ZCB")
echo "  A=$A  B=$B"
if [ -z "$A" ] || [ -z "$B" ]; then echo "FAILED to create scratch teams"; exit 1; fi

echo "== 4. bulk create 3 players on A =="
curl -s -b "$J/cookies.txt" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"teamId\":\"$A\",\"players\":[
    {\"name\":\"Copy Test Alpha\",\"role\":\"Batsman\",\"isCaptain\":true,\"isKeeper\":false,\"battingStyle\":\"Right-hand bat\",\"bowlingStyle\":\"\"},
    {\"name\":\"Copy Test Bravo\",\"role\":\"Bowler\",\"isCaptain\":false,\"isKeeper\":false,\"battingStyle\":\"Left-hand bat\",\"bowlingStyle\":\"Right-arm fast\"},
    {\"name\":\"Copy Test Charlie\",\"role\":\"Wicket-keeper\",\"isCaptain\":false,\"isKeeper\":true,\"battingStyle\":\"Right-hand bat\",\"bowlingStyle\":\"\"}]}" \
  "$BASE/api/players/bulk" | python3 -m json.tool

echo "== 5. copy A -> B (expect created 3) =="
curl -s -b "$J/cookies.txt" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"sourceTeamId\":\"$A\",\"targetTeamId\":\"$B\"}" \
  "$BASE/api/players/copy" | python3 -m json.tool

echo "== 6. re-copy A -> B (expect created 0, skipped 3) =="
curl -s -b "$J/cookies.txt" -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d "{\"sourceTeamId\":\"$A\",\"targetTeamId\":\"$B\"}" \
  "$BASE/api/players/copy" | python3 -m json.tool

echo "== 7. unauthenticated copy attempt (expect 401) =="
curl -s -o /dev/null -w '  HTTP %{http_code}\n' -H "Content-Type: application/json" \
  -d "{\"sourceTeamId\":\"$A\",\"targetTeamId\":\"$B\"}" "$BASE/api/players/copy"

echo "== 8. copy-sources honours excludeTeamId =="
curl -s "$BASE/api/players/copy-sources?excludeTeamId=$A" > "$J/sources2.json"
python3 - "$A" <<'EOF'
import json, sys
exclude = sys.argv[1]
d = json.load(open('/tmp/verify-roster/sources2.json'))
names = [t['name'] for s in d.get('sources', []) for t in s['teams']]
print("  'ZZ Copy Test A' excluded:", "ZZ Copy Test A" not in names)
print("  'ZZ Copy Test B' present:  ", "ZZ Copy Test B" in names)
EOF

echo "== 9. cleanup scratch teams (cascades players) =="
for T in "$A" "$B"; do
  curl -s -b "$J/cookies.txt" -H "X-CSRF-Token: $CSRF" -X DELETE \
    "$BASE/api/teams/$T" -o /dev/null -w "  DELETE $T -> HTTP %{http_code}\n"
done
echo "DONE"
