#!/bin/sh

###
# This script is intended to be run inside of docker.  It will build the app
# and create a release.tar file.
#
# It should be invoked with:
#
# docker run \
#   -e RELEASE_UID=$(id -u) \
#   -e RELEASE_GID=$(id -g) \
#   --rm \
#   -v "$(pwd):/source" \
#   -w /source \
#   node \
#   /source/ngap/bamboo/npm_release_in_docker.sh
#
###

set -e

npm run release
rm -rf dist
chown "${RELEASE_UID}:${RELEASE_GID}" /source/release.tar