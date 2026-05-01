#!/bin/sh
set -e
cd $CI_WORKSPACE
npm install
npx cap sync ios
cd $CI_WORKSPACE/ios/App
pod install
