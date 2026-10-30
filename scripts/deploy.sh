#!/usr/bin/env bash
# deploy เว็บจริง network.sdnthailand.com — รันจากเครื่อง dev หลัง git push:
#   bash scripts/deploy.sh
# ต่อ SSH ไปเซิร์ฟเวอร์ (host `runludtong` ใน ~/.ssh/config — เครื่องเดียวกับ photorun) แล้ว:
#   Plesk Git ดึง + deploy ไฟล์ → npm install (เฉพาะเมื่อ package-lock เปลี่ยน) → build → Passenger restart
# ไม่แตะฐานข้อมูล — ไฟล์ใหม่ใน prisma/production-sql/ ต้องรันใน phpMyAdmin ก่อน deploy เสมอ
# โฟลเดอร์แอปไม่ใช่ git checkout (Plesk Git deploy ไฟล์ให้) จึงใช้ `plesk ext git` แทน git pull
set -euo pipefail

if [ -n "$(git status --porcelain --untracked-files=no)" ] || [ "$(git rev-parse HEAD)" != "$(git rev-parse '@{u}' 2>/dev/null)" ]; then
  echo "⚠️  มีงานที่ยังไม่ commit หรือยังไม่ push — เซิร์ฟเวอร์จะได้แค่ของที่อยู่บน GitHub" >&2
fi

ssh runludtong 'bash -s' <<'REMOTE'
set -euo pipefail
DOMAIN=network.sdnthailand.com
APP=/var/www/vhosts/sdnthailand.com/network.sdnthailand.com
APP_USER=$(stat -c %U "$APP/package.json")

plesk ext git --fetch -domain "$DOMAIN" -name stopdrinknetwork
plesk ext git --deploy -domain "$DOMAIN" -name stopdrinknetwork
echo "ไฟล์ล่าสุด: $(plesk ext git --get-last-commit -domain "$DOMAIN" -name stopdrinknetwork 2>/dev/null | head -1)"

su -s /bin/bash "$APP_USER" -c "set -euo pipefail
  cd '$APP'
  export PATH=\$(ls -d /opt/plesk/node/*/bin | sort -V | tail -1):\$PATH
  export NODE_OPTIONS=--dns-result-order=ipv4first   # IPv6 ของ VPS ใช้ไม่ได้เป็นบางช่วง (บทเรียนจาก photorun)
  mkdir -p tmp
  LOCK=\$(sha1sum package-lock.json | cut -d' ' -f1)
  if [ \"\$LOCK\" != \"\$(cat tmp/.lock-hash 2>/dev/null)\" ]; then
    npm install --no-audit --no-fund
    echo \"\$LOCK\" > tmp/.lock-hash
  fi
  npm run build
  touch tmp/restart.txt
"
echo "deploy เสร็จ — Passenger รีสตาร์ทแล้ว"
REMOTE
