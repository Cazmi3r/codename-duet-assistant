#!/bin/sh
# Runs the tests, then copies the site to the production server.
#
# The destination is kept out of the repository. Set it either way:
#   - put it in deploy/target (ignored by git), or
#   - export DEPLOY_TARGET
# in rsync form, for example: user@your-server:/var/www/duetkeycard/
set -eu
cd "$(dirname "$0")/.."
if [ -z "${DEPLOY_TARGET:-}" ] && [ -f deploy/target ]; then
	DEPLOY_TARGET=$(head -n 1 deploy/target)
fi
if [ -z "${DEPLOY_TARGET:-}" ]; then
	echo "No deploy destination. Create deploy/target or set DEPLOY_TARGET (see the top of this script)." >&2
	exit 1
fi
npm test --silent
rsync -av --delete public/ "$DEPLOY_TARGET"
