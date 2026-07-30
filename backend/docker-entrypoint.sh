#!/usr/bin/env sh
set -eu

node node_modules/prisma/build/index.js migrate deploy
exec node dist/index.js
