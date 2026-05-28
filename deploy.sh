#!/bin/bash
# deploy.sh — בנה ופרס את TRIPO
set -e

echo "🔨 בונה client..."
cd /home/dor/tripo/client
npm run build

echo "🔄 מאתחל שרת..."
pm2 restart tripo-server

echo "✅ פריסה הושלמה!"
echo "   client: /home/dor/tripo/client/dist"
echo "   server: pm2 tripo-server (port 3018)"
