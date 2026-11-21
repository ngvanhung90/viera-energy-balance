package com.vieralabs.energybalance

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.SystemClock
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.ai.FirebaseAI
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.OnDeviceModelOption
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.generationConfig
import com.google.firebase.appcheck.FirebaseAppCheck
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import org.json.JSONObject

@OptIn(PublicPreviewAPI::class)
internal class NativeCoach(private val context: Context) {
    private val cloudModel = "gemini-3.5-flash-lite"
    private var quotaUntil = 0L
    private val config = runCatching {
        context.assets.open("viera-native-config.json").bufferedReader().use { JSONObject(it.readText()) }
    }.getOrNull()
    private val app by lazy {
        val value = config?.optJSONObject("firebase") ?: return@lazy null
        if (listOf("appId", "projectId", "apiKey").any { value.optString(it).isBlank() }) return@lazy null
        val options = FirebaseOptions.Builder()
            .setApplicationId(value.getString("appId"))
            .setProjectId(value.getString("projectId"))
            .setApiKey(value.getString("apiKey"))
            .build()
        FirebaseApp.initializeApp(context, options, "viera-energy-android")
    }
    private val device by lazy {
        app?.let { firebase ->
            FirebaseAI.getInstance(firebase, GenerativeBackend.googleAI()).generativeModel(
                modelName = cloudModel,
                onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_ON_DEVICE, modelOption = OnDeviceModelOption.PREVIEW_FAST)
            )
        }
    }
    private val check by lazy { app?.let { FirebaseAppCheck.getInstance(it).also(::installAttestation) } }

    suspend fun run(payload: JSONObject): JSONObject = try {
        when (payload.optString("operation")) {
            "status" -> JSONObject().put("availability", withTimeout(3000) { availability() })
                .put("cloudConfigured", config?.optBoolean("sparkBillingVerified") == true && app != null)
            "generate" -> infer(payload.optString("branch"), payload.optString("prompt"))
            else -> error("service-error")
        }
    } catch (_: TimeoutCancellationException) {
        failure("deadline")
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (error: Exception) {
        val message = error.message.orEmpty()
        val reason = when {
            "429" in message || Regex("resource.exhausted|quota", RegexOption.IGNORE_CASE).containsMatchIn(message) -> "quota"
            "403" in message || Regex("app.check|permission.denied", RegexOption.IGNORE_CASE).containsMatchIn(message) -> "app-check"
            message in setOf("offline", "cloud-not-configured", "firebase-config-missing", "device-unavailable",
                "unexpected-source", "invalid-selection") -> message
            else -> "service-error"
        }
        if (reason == "quota") quotaUntil = SystemClock.elapsedRealtime() + 60000
        failure(reason)
    }

    private suspend fun availability(): String {
        val aicore = runCatching { context.packageManager.getPackageInfo("com.google.android.aicore", 0) }.isSuccess
        if (!aicore) return "unavailable"
        val extension = device?.onDeviceExtension ?: return "unavailable"
        return extension.checkStatus().name.lowercase()
    }

    private suspend fun infer(branch: String, prompt: String): JSONObject {
        require(prompt.isNotBlank() && prompt.length <= 8000) { "invalid-selection" }
        val firebase = app ?: error("firebase-config-missing")
        val started = SystemClock.elapsedRealtime()
        var deviceName: String? = null
        val model = if (branch == "device") {
            if (withTimeout(3000) { availability() } != "available") error("device-unavailable")
            deviceName = withTimeout(3000) { device?.onDeviceExtension?.getModelName() }
            if (deviceName?.contains("nano-v4", ignoreCase = true) != true) error("device-unavailable")
            device ?: error("device-unavailable")
        } else {
            if (branch != "cloud" || config?.optBoolean("sparkBillingVerified") != true) error("cloud-not-configured")
            if (!online()) error("offline")
            if (started < quotaUntil) error("quota")
            val appCheck = check ?: error("app-check")
            try {
                if (withTimeout(7000) { appCheck.getAppCheckToken(false).await() }.token.isBlank()) error("app-check")
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                error("app-check")
            }
            FirebaseAI.getInstance(firebase, GenerativeBackend.googleAI()).generativeModel(
                modelName = cloudModel,
                generationConfig = generationConfig { responseMimeType = "application/json"; maxOutputTokens = 128 },
                onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_IN_CLOUD)
            )
        }
        val response = withTimeout(12000) { model.generateContent(prompt) }
        val expected = if (branch == "cloud") "IN_CLOUD" else "ON_DEVICE"
        if (response.inferenceSource.name != expected) error("unexpected-source")
        return JSONObject().put("text", response.text).put("source", expected)
            .put("model", deviceName)
            .put("milliseconds", SystemClock.elapsedRealtime() - started)
    }

    private fun online(): Boolean {
        val manager = context.getSystemService(ConnectivityManager::class.java)
        return manager.getNetworkCapabilities(manager.activeNetwork)
            ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
    }

    private fun failure(reason: String) = JSONObject().put("reason", reason)
}
