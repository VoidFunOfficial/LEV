#!/bin/sh
# Downloads Node.js for iOS (nodejs-mobile) and unpacks NodeMobile.xcframework into mobile/ios/build.
set -eu
ios=$(cd "$(dirname "$0")" && pwd)
cache="$ios/../build/downloads"
name=nodejs-mobile-ios-24.22.1-0.zip
digest=3fa1b8fb0720768b01c2e0dae3a17e788476e8c1613a1d9a54e206793b45326e
url=https://github.com/fogtape/nodejs-mobile/releases/download/v24.22.1-0/$name
mkdir -p "$cache" "$ios/build"
valid() { [ -f "$1" ] && [ "$(shasum -a 256 "$1" | cut -d' ' -f1)" = "$digest" ]; }
if ! valid "$cache/$name"; then
  curl -fLsS --retry 2 "$url" -o "$cache/$name.part"
  valid "$cache/$name.part" || { echo "Checksum mismatch for $name" >&2; exit 1; }
  mv "$cache/$name.part" "$cache/$name"
fi
rm -rf "$ios/build/NodeMobile.xcframework"
unzip -q "$cache/$name" 'NodeMobile.xcframework/*' -d "$ios/build"
echo "Prepared $ios/build/NodeMobile.xcframework"
