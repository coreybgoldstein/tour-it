#!/bin/sh
set -e
brew install node
cd /Volumes/workspace/repository
npm install
npx cap sync ios