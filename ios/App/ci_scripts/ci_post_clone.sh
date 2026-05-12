#!/bin/sh
brew install node
cd /Volumes/workspace/repository
npm install
npx cap sync ios
