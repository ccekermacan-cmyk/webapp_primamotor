#!/usr/bin/env bash
# Siapkan environment build Android tanpa Android Studio, tanpa root.
# Idempoten: aman dijalankan ulang.
#
# Yang dipasang (semua di $HOME, tidak menyentuh sistem):
#   ~/jdk/jdk-17              Temurin JDK 17 (untuk Gradle/AGP)
#   ~/android-sdk             SDK CLI (platform-tools, platform 35, build-tools 35)
#   ~/.gradle/wrapper         cache Gradle (lewat ./gradlew)
#
# Yang TIDAK dipasang di sini (butuh root, jalankan manual):
#   sudo apt install scrcpy
#   aturan udev supaya `adb devices` melihat HP tanpa root
set -euo pipefail

JDK_HOME_DIR="$HOME/jdk/jdk-17"
SDK_ROOT="$HOME/android-sdk"
CMDLINE_ZIP_URL="https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip"
JDK_URL="https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse?project=jdk"
GRADLE_VERSION="8.9"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() { printf '\n==> %s\n' "$1"; }

say "1/5 JDK 17"
if [ ! -x "$JDK_HOME_DIR/bin/java" ]; then
  tmp="$(mktemp -d)"
  curl -fsSL "$JDK_URL" -o "$tmp/jdk.tar.gz"
  mkdir -p "$HOME/jdk"
  tar -xzf "$tmp/jdk.tar.gz" -C "$HOME/jdk"
  # nama folder hasil ekstrak: jdk-17.0.x+y
  extracted="$(find "$HOME/jdk" -maxdepth 1 -type d -name 'jdk-17*' | head -1)"
  rm -rf "$JDK_HOME_DIR"
  mv "$extracted" "$JDK_HOME_DIR"
  rm -rf "$tmp"
fi
export JAVA_HOME="$JDK_HOME_DIR"
"$JDK_HOME_DIR/bin/java" -version

say "2/5 Android SDK command line tools"
if [ ! -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
  tmp="$(mktemp -d)"
  curl -fsSL "$CMDLINE_ZIP_URL" -o "$tmp/cmdline.zip"
  mkdir -p "$SDK_ROOT/cmdline-tools"
  unzip -q "$tmp/cmdline.zip" -d "$tmp"
  rm -rf "$SDK_ROOT/cmdline-tools/latest"
  mv "$tmp/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
  rm -rf "$tmp"
fi
export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="$JAVA_HOME/bin:$SDK_ROOT/platform-tools:$SDK_ROOT/cmdline-tools/latest/bin:$PATH"

say "3/5 paket SDK"
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
yes | sdkmanager --licenses >/dev/null || true

say "4/5 PATH di ~/.bashrc"
LINE='export JAVA_HOME=$HOME/jdk/jdk-17; export ANDROID_HOME=$HOME/android-sdk; export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH'
touch "$HOME/.bashrc"
if ! grep -qF 'android-sdk' "$HOME/.bashrc"; then
  printf '\n# Android SDK (ditambahkan scripts/android-env.sh)\n%s\n' "$LINE" >> "$HOME/.bashrc"
fi

say "5/5 Gradle wrapper"
if [ -f "$REPO_ROOT/Android/settings.gradle.kts" ] && [ ! -x "$REPO_ROOT/Android/gradlew" ]; then
  tmp="$(mktemp -d)"
  curl -fsSL "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -o "$tmp/gradle.zip"
  unzip -q "$tmp/gradle.zip" -d "$tmp"
  ( cd "$REPO_ROOT/Android" && "$tmp/gradle-${GRADLE_VERSION}/bin/gradle" wrapper --gradle-version "$GRADLE_VERSION" --distribution-type bin )
  rm -rf "$tmp"
fi

say "Selesai"
"$SDK_ROOT/platform-tools/adb" version || true
printf 'adb devices:\n'
"$SDK_ROOT/platform-tools/adb" devices || true
printf '\nLangkah manual (butuh root):\n  sudo apt install scrcpy\n'
printf '  sudo curl -fsSL https://raw.githubusercontent.com/M0Rf30/android-udev-rules/main/51-android.rules -o /etc/udev/rules.d/51-android.rules && sudo udevadm control --reload-rules && sudo udevadm trigger\n'