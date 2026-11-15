#!/bin/sh
# Builds the iOS app after `npm run ios:prepare` (macOS with Xcode).
#   sh mobile/ios/build.sh simulator
#       Debug build for the iOS Simulator: mobile/ios/build/sim/Build/Products/Debug-iphonesimulator/LearnEV.app
#   sh mobile/ios/build.sh
#       Device build: dist/release/learnev-<version>-ios-unsigned.ipa. With LEARNEV_IOS_TEAM_ID and
#       LEARNEV_IOS_PROFILE (provisioning profile name or UUID) set, and the signing certificate in a
#       keychain, it signs and exports dist/release/learnev-<version>-ios.ipa instead.
#       Optional: LEARNEV_IOS_BUNDLE_ID (default app.learnev.ios), LEARNEV_IOS_IDENTITY
#       (default "Apple Distribution"), LEARNEV_IOS_EXPORT_METHOD (default release-testing, i.e. ad hoc).
set -eu
ios=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$ios/../.." && pwd)
[ -f "$root/mobile/build/runtime/server.mjs" ] && [ -d "$ios/build/NodeMobile.xcframework" ] ||
  { echo "Run npm run ios:prepare from the repository root first." >&2; exit 1; }
version=$(node -p 'require(process.argv[1]).version' "$root/package.json")
code=$(node -p 'const [a, b, c] = process.argv[1].split("-")[0].split(".").map(Number); a * 10000 + b * 100 + c' "$version")
bundle=${LEARNEV_IOS_BUNDLE_ID:-app.learnev.ios}
set -- "${1:-device}"
cd "$ios"

if [ "$1" = simulator ]; then
  xcodebuild -project LearnEV.xcodeproj -scheme LearnEV -configuration Debug -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' -derivedDataPath build/sim -quiet build \
    MARKETING_VERSION="$version" CURRENT_PROJECT_VERSION="$code" PRODUCT_BUNDLE_IDENTIFIER="$bundle"
  echo "built $ios/build/sim/Build/Products/Debug-iphonesimulator/LearnEV.app"
  exit 0
fi

out="$root/dist/release"
mkdir -p "$out"
rm -rf build/LearnEV.xcarchive build/export build/Payload
if [ -n "${LEARNEV_IOS_TEAM_ID:-}" ] && [ -n "${LEARNEV_IOS_PROFILE:-}" ]; then
  xcodebuild -project LearnEV.xcodeproj -scheme LearnEV -configuration Release -destination 'generic/platform=iOS' \
    -derivedDataPath build/device -archivePath build/LearnEV.xcarchive -quiet archive \
    MARKETING_VERSION="$version" CURRENT_PROJECT_VERSION="$code" PRODUCT_BUNDLE_IDENTIFIER="$bundle" \
    CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="$LEARNEV_IOS_TEAM_ID" \
    CODE_SIGN_IDENTITY="${LEARNEV_IOS_IDENTITY:-Apple Distribution}" PROVISIONING_PROFILE_SPECIFIER="$LEARNEV_IOS_PROFILE"
  cat > build/ExportOptions.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>${LEARNEV_IOS_EXPORT_METHOD:-release-testing}</string>
  <key>teamID</key><string>$LEARNEV_IOS_TEAM_ID</string>
  <key>signingStyle</key><string>manual</string>
  <key>provisioningProfiles</key><dict><key>$bundle</key><string>$LEARNEV_IOS_PROFILE</string></dict>
</dict></plist>
PLIST
  xcodebuild -exportArchive -archivePath build/LearnEV.xcarchive -exportOptionsPlist build/ExportOptions.plist \
    -exportPath build/export -quiet
  ipa="$out/learnev-$version-ios.ipa"
  cp build/export/LearnEV.ipa "$ipa"
else
  xcodebuild -project LearnEV.xcodeproj -scheme LearnEV -configuration Release -destination 'generic/platform=iOS' \
    -derivedDataPath build/device -archivePath build/LearnEV.xcarchive -quiet archive \
    MARKETING_VERSION="$version" CURRENT_PROJECT_VERSION="$code" PRODUCT_BUNDLE_IDENTIFIER="$bundle" \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=""
  # An unsigned .ipa has to be signed before it installs, for example by AltStore or Sideloadly.
  mkdir -p build/Payload
  cp -R build/LearnEV.xcarchive/Products/Applications/LearnEV.app build/Payload/
  ipa="$out/learnev-$version-ios-unsigned.ipa"
  rm -f "$ipa"
  (cd build && zip -qry "$ipa" Payload)
fi
echo "packed $ipa ($(du -h "$ipa" | cut -f1))"
