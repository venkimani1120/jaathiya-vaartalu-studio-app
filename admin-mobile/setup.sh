#!/usr/bin/env bash
# Creates the Expo project with matching library versions, then copies this app's code into it.
set -e
cd "$(dirname "$0")"
if [ ! -d jv-mobile ]; then
  npx --yes create-expo-app@latest jv-mobile --template blank --yes
fi
rm -rf jv-mobile/src   # drop screens removed from this app
cp -r App.js app.json eas.json src jv-mobile/
cd jv-mobile
npx expo install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context \
  expo-image-picker expo-secure-store expo-status-bar react-native-webview expo-build-properties
npm install axios
echo "Done. Edit jv-mobile/src/config.js with your API URL, then: cd jv-mobile && npx expo start"
