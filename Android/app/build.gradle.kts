import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

/** Satu sumber alamat layanan: file `datasource` di root repo (lihat DATASOURCE.md). */
fun datasourceValue(key: String): String? {
    val file = rootProject.projectDir.parentFile?.resolve("datasource") ?: return null
    if (!file.exists()) return null
    return file.readLines()
        .map { it.trim() }
        .firstOrNull { it.startsWith("$key=") }
        ?.substringAfter("=")
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
}

val posBaseUrl: String = (findProperty("posBaseUrl") as String?)
    ?: datasourceValue("PB_PUBLIC_URL")
    ?: "http://localhost:8090"

val posApiUrl: String = (findProperty("posApiUrl") as String?)
    ?: datasourceValue("API_PUBLIC_URL")
    ?: ""

/**
 * Keystore rilis dari `Android/keystore.properties` (tidak masuk git).
 * Tanpa file itu, APK rilis ditandatangani debug key supaya tetap bisa diuji di HP toko.
 * Untuk distribusi nyata, isi keystore.properties dan simpan keystore di luar repo.
 */
val keystoreProperties = Properties().apply {
    val file = rootProject.projectDir.resolve("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "id.primamotor.pos"
    compileSdk = 35

    defaultConfig {
        applicationId = "id.primamotor.pos"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "POS_BASE_URL", "\"$posBaseUrl\"")
        buildConfigField("String", "POS_API_URL", "\"$posApiUrl\"")
    }

    signingConfigs {
        create("release") {
            if (keystoreProperties.isEmpty) {
                storeFile = File(System.getProperty("user.home"), ".android/debug.keystore")
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            } else {
                storeFile = rootProject.projectDir.resolve(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    // Anggaran ringan: satu ABI. Tambah "armeabi-v7a" hanya jika HP toko 32-bit.
    splits {
        abi {
            isEnable = true
            reset()
            include("arm64-v8a")
            isUniversalApk = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests.all {
            it.systemProperty(
                "repo.root",
                rootProject.projectDir.parentFile?.absolutePath ?: rootProject.projectDir.absolutePath,
            )
        }
    }

    packaging {
        resources.excludes += setOf(
            "/META-INF/{AL2.0,LGPL2.1}",
            "/META-INF/LICENSE*",
            "/META-INF/NOTICE*",
        )
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    implementation(libs.okhttp)
    implementation(libs.androidx.work.runtime)
    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.view)
    implementation(libs.zxing.core)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.security.crypto)
    ksp(libs.androidx.room.compiler)

    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    testImplementation(libs.junit)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.kotlinx.coroutines.test)

    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.okhttp.mockwebserver)
}