#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Missing node_modules. Installing dependencies..."
  npm install
fi

echo "Nuxt app will run at:"
echo "http://127.0.0.1:4178"
echo
echo "Press Ctrl+C in this terminal to stop the Nuxt server."
echo

npm run build

export HOST=127.0.0.1
export PORT=4178
npm run start
