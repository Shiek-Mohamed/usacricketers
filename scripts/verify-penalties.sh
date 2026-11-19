#!/bin/bash
# E2E verification of the Penalties & Deductions feature.
# Auto-picks a series with completed matches (non-empty standings), then
# exercises: baseline -> add points penalty -> add NRR penalty -> list ->
# delete -> restored. Plus auth + validation checks.
BASE=http://localhost:3000
J=/tmp/verify-pen
mkdir -p "$J"

echo "== login site admin =="
curl -s -c "$J/cookies.txt" -H 'Content-Type: application/json' \
  -d '{"email":"admin@usacricketers.test","password":"admin123"}' \
  "$BASE/api/admin/login" -o /dev/null
CSRF=$(awk '/csrf-token/{print $NF; exit}' "$J/cookies.txt")
echo "  csrf: ${CSRF:0:8}…"

echo "== pick a series with completed matches =="
SID=""
for id in $(curl -s "$BASE/api/series" | python3 -c "import json,sys;[print(s['id']) for s in json.load(sys.stdin)]" 2>/dev/null); do
  n=$(curl -s "$BASE/api/standings?seriesId=$id" | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)" 2>/dev/null)
  if [ "$n" -gt 0 ] 2>/dev/null; then
    SID=$id
    echo "  picked: $SID  ($n standings rows)"
    break
  fi
done
if [ -z "$SID" ]; then
  echo "  No series with completed matches found — cannot E2E test. Aborting."
  exit 1
fi

echo "== baseline standings =="
curl -s "$BASE/api/standings?seriesId=$SID" > "$J/base.json"
python3 - "$J/base.json" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1]))
for s in d:
    print(f"  {s['teamShortName']:6} P{s['played']} W{s['won']} pts={s['points']} eff={s['effectivePoints']} penPts={s['penaltyPoints']} nrr={s['nrr']} effNrr={s['effectiveNrr']}")
EOF

TID=$(python3 -c "import json;d=json.load(open('$J/base.json'));print(d[0]['teamId'])")
TNAME=$(python3 -c "import json;d=json.load(open('$J/base.json'));print(d[0]['teamShortName'])")
BASEPTS=$(python3 -c "import json;d=json.load(open('$J/base.json'));print(d[0]['points'])")
BASEEFFNRR=$(python3 -c "import json;d=json.load(open('$J/base.json'));print(d[0]['effectiveNrr'])")
echo "== target team: $TNAME ($TID)  baseline pts=$BASEPTS effNrr=$BASEEFFNRR =="

echo "== unauthenticated POST (expect 401) =="
curl -s -o /dev/null -w '  HTTP %{http_code}\n' -H 'Content-Type: application/json' \
  -d "{\"teamId\":\"$TID\",\"type\":\"points\",\"value\":2}" \
  "$BASE/api/series/$SID/penalties"

echo "== invalid type (expect 400) =="
curl -s -b "$J/cookies.txt" -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d "{\"teamId\":\"$TID\",\"type\":\"runs\",\"value\":2}" \
  "$BASE/api/series/$SID/penalties" | python3 -m json.tool

echo "== non-positive points deduction (expect 400) =="
curl -s -b "$J/cookies.txt" -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d "{\"teamId\":\"$TID\",\"type\":\"points\",\"value\":0}" \
  "$BASE/api/series/$SID/penalties" | python3 -m json.tool

echo "== add points penalty (-2) =="
RESP=$(curl -s -b "$J/cookies.txt" -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d "{\"teamId\":\"$TID\",\"type\":\"points\",\"value\":2,\"reason\":\"Slow over-rate\"}" \
  "$BASE/api/series/$SID/penalties")
echo "  $RESP"
PID=$(echo "$RESP" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('item',{}).get('id',''))")
echo "  penalty id: $PID"

echo "== standings after points penalty (expect target eff = baseline - 2) =="
curl -s "$BASE/api/standings?seriesId=$SID" > "$J/after1.json"
python3 - "$J/after1.json" "$TID" "$BASEPTS" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1])); tid = sys.argv[2]; base = int(sys.argv[3])
target = next((s for s in d if s['teamId'] == tid), None)
ok = target and target['effectivePoints'] == base - 2 and target['penaltyPoints'] == 2
print("  target eff pts == base-2:", ok)
for s in d:
    mark = " <== TARGET" if s['teamId'] == tid else ""
    print(f"  {s['teamShortName']:6} pts={s['points']} eff={s['effectivePoints']} penPts={s['penaltyPoints']}{mark}")
EOF

echo "== add NRR adjustment (-0.5) =="
curl -s -b "$J/cookies.txt" -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d "{\"teamId\":\"$TID\",\"type\":\"nrr\",\"value\":-0.5,\"reason\":\"Pitch violation\"}" \
  "$BASE/api/series/$SID/penalties" -o /dev/null -w '  HTTP %{http_code}\n'

echo "== penalties list (expect 2) =="
curl -s "$BASE/api/series/$SID/penalties" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('  count:', len(d.get('items',[])))
for it in d.get('items',[]):
    print(f\"  {it['teamName']:10} {it['type']:7} val={it['value']} reason={it['reason']!r}\")
"

echo "== standings after NRR penalty (expect target effNrr = baseline - 0.5) =="
curl -s "$BASE/api/standings?seriesId=$SID" > "$J/after2.json"
python3 - "$J/after2.json" "$TID" "$BASEEFFNRR" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1])); tid = sys.argv[2]; base = float(sys.argv[3])
target = next((s for s in d if s['teamId'] == tid), None)
ok = target and abs(target['effectiveNrr'] - (base - 0.5)) < 0.01 and abs(target['penaltyNrr'] - (-0.5)) < 0.01
print("  target effNrr == base-0.5:", ok)
for s in d:
    mark = " <== TARGET" if s['teamId'] == tid else ""
    print(f"  {s['teamShortName']:6} effPts={s['effectivePoints']} effNrr={s['effectiveNrr']} penNrr={s['penaltyNrr']}{mark}")
EOF

echo "== delete all penalties =="
for P in $(curl -s "$BASE/api/series/$SID/penalties" | python3 -c "import json,sys;d=json.load(sys.stdin);[print(it['id']) for it in d.get('items',[])]"); do
  curl -s -b "$J/cookies.txt" -H "X-CSRF-Token: $CSRF" -X DELETE \
    "$BASE/api/penalties/$P" -o /dev/null -w "  DELETE $P -> HTTP %{http_code}\n"
done

echo "== unauthenticated DELETE (expect 401) =="
RESP=$(curl -s -b "$J/cookies.txt" -H 'Content-Type: application/json' -H "X-CSRF-Token: $CSRF" \
  -d "{\"teamId\":\"$TID\",\"type\":\"points\",\"value\":1,\"reason\":\"tmp\"}" \
  "$BASE/api/series/$SID/penalties")
LASTPID=$(echo "$RESP" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('item',{}).get('id',''))")
if [ -n "$LASTPID" ]; then
  curl -s -o /dev/null -w '  no-auth DELETE -> HTTP %{http_code}\n' -X DELETE "$BASE/api/penalties/$LASTPID"
  curl -s -b "$J/cookies.txt" -H "X-CSRF-Token: $CSRF" -X DELETE "$BASE/api/penalties/$LASTPID" -o /dev/null
fi

echo "== final standings (penalties cleared, eff == pts) =="
curl -s "$BASE/api/standings?seriesId=$SID" | python3 -c "
import json,sys
d=json.load(sys.stdin)
ok=all(s['penaltyPoints']==0 and s['penaltyNrr']==0 and s['effectivePoints']==s['points'] for s in d)
print('  fully restored:', ok)
for s in d:
    print(f\"  {s['teamShortName']:6} eff={s['effectivePoints']} penPts={s['penaltyPoints']} penNrr={s['penaltyNrr']}\")
"
echo "DONE"
