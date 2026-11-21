buildscript {
    repositories {
        google()
        maven("https://storage.googleapis.com/r8-releases/raw") {
            content { includeModule("com.android.tools", "r8") }
        }
    }
    dependencies { classpath("com.android.tools:r8:9.1.29") }
}

plugins {
    id("com.android.application") version "8.13.2" apply false
    id("org.jetbrains.kotlin.android") version "2.4.21" apply false
}
