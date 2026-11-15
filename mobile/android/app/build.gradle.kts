import groovy.json.JsonSlurper

plugins { id("com.android.application") }

// Version name follows package.json; 1.2.3 becomes version code 10203.
val appVersion = (JsonSlurper().parse(rootDir.resolve("../../package.json")) as Map<*, *>)["version"] as String
val (major, minor, patch) = appVersion.substringBefore('-').split('.').map(String::toInt)
// CI passes unset secrets as empty strings.
fun setting(name: String) = System.getenv(name)?.takeIf { it.isNotEmpty() }
val keystore = setting("LEARNEV_ANDROID_KEYSTORE")

android {
    namespace = "app.learnev.android"
    compileSdk = 36
    defaultConfig {
        applicationId = "app.learnev.android"
        minSdk = 28
        targetSdk = 36
        versionCode = major * 10000 + minor * 100 + patch
        versionName = appVersion
    }
    signingConfigs {
        if (keystore != null) create("release") {
            storeFile = file(keystore)
            storePassword = setting("LEARNEV_ANDROID_KEYSTORE_PASSWORD")
            keyAlias = setting("LEARNEV_ANDROID_KEY_ALIAS")
            keyPassword = setting("LEARNEV_ANDROID_KEY_PASSWORD") ?: storePassword
        }
    }
    buildTypes {
        release {
            // Without a release keystore the APK carries the build machine's debug key, so it still installs.
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }
    sourceSets["main"].assets.directories.add("build/generated/learnev/assets")
    sourceSets["main"].jniLibs.directories.add("build/generated/learnev/jniLibs")
    packaging.jniLibs.useLegacyPackaging = true
    androidResources.noCompress += "zip"
}

tasks.named("preBuild") {
    doFirst {
        val folder = layout.buildDirectory.dir("generated/learnev").get().asFile
        check(folder.resolve("assets/runtime.zip").isFile && folder.resolve("jniLibs/arm64-v8a/liblearnev.so").isFile) {
            "Run npm run android:prepare from the repository root first."
        }
    }
}
