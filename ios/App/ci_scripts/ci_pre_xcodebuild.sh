#!/bin/sh
set -e
export HOME=/Users/local/xcodecloud
cd $CI_WORKSPACE
npm install
npx cap sync ios --no-build