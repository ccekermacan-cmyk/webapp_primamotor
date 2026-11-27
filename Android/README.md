# Prima Motor POS — Android

Aplikasi POS Android native (Kotlin + Compose). Tanpa Android Studio, tanpa emulator.

## Environment (sudah terpasang di mesin ini)

| Komponen | Lokasi |
| --- | --- |
| JDK 17 (Temurin) | `~/jdk/jdk-17` |
| Android SDK | `~/android-sdk` (`platforms;android-35`, `build-tools;35.0.0`, `platform-tools`) |
| Gradle | wrapper proyek (`./gradlew`), distribusi 8.9 |
| HP uji | fisik via USB; mirror layar dengan `scrcpy` |

Semua dipasang ulang kapan saja dengan `../scripts/android-env.sh` (idempoten, tanpa root).

`~/.bashrc` sudah memuat:

```bash
export JAVA_HOME=$HOME/jdk/jdk-17
export ANDROID_HOME=$HOME/android-sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
```

`Android/local.properties` berisi `sdk.dir=$HOME/android-sdk` (tidak di-commit).

## Izin USB (butuh root, sekali saja)

```bash
sudo curl -fsSL https://raw.githubusercontent.com/M0Rf30/android-udev-rules/main/51-android.rules -o /etc/udev/rules.d/51-android.rules
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Cabut-colok kabel, lalu `adb devices` harus menampilkan `device` (bukan `no permissions`). Di HP: *Allow USB debugging*.

## Perintah

```bash
cd Android
./gradlew :app:assembleDebug          # APK debug
./gradlew :app:assembleRelease        # APK release (R8 + shrink + split arm64)
./gradlew :app:lintDebug              # lint
./gradlew :app:testDebugUnitTest      # unit test (JVM)
./gradlew :app:connectedDebugAndroidTest   # uji di HP fisik

adb install -r app/build/outputs/apk/debug/app-arm64-v8a-debug.apk
adb shell am start -W id.primamotor.pos/.MainActivity   # ukur cold start
adb logcat -s PrimaMotor:* AndroidRuntime:E
adb exec-out screencap -p > /tmp/s.png                  # screenshot
scrcpy                                                  # mirror + kontrol layar
```

## Anggaran (dipatok, diukur)

| Metrik | Target | Sekarang |
| --- | --- | --- |
| APK release arm64 | ≤ 12 MB | 0,8 MB (unsigned, Task 1) |
| Cold start (debug, Pixel/CPH2461 Android 14) | ≤ 2000 ms | 1535 ms |
| Query Room POS | < 50 ms | belum ada Room |

Naikkan angka di tabel saat task selesai; jangan naikkan target.

## Catatan

- `minSdk 26`, `compileSdk`/`targetSdk 35`, hanya `arm64-v8a` (tambah `armeabi-v7a` kalau HP toko 32-bit).
- HTTP cleartext hanya di varian debug (`app/src/debug/res/xml/network_security_config.xml`).
- Base URL layanan mengikuti `datasource` di root repo saat build (Task 4); jangan hardcode.
- Tanpa Hilt, tanpa Retrofit/Ktor, tanpa SQLCipher, tanpa library chart.
- Rencana lengkap: `docs/superpowers/plans/2026-11-27-android-pos-native.md`.

## Uji di HP fisik (checklist fase 0)

- [x] `adb devices` menampilkan `device`
- [x] `./gradlew :app:connectedDebugAndroidTest` lulus (ShellTest)
- [x] `adb shell am start -W` ≤ 2000 ms (1535 ms, debug)
- [x] `scrcpy` bisa mengontrol layar
- [ ] Mode pesawat: aplikasi tetap terbuka