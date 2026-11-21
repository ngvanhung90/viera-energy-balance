package com.vieralabs.energybalance.qa

import android.app.Activity
import android.app.Instrumentation
import android.os.Bundle
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.ai.FirebaseAI
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.ServerException
import com.google.firebase.ai.type.generationConfig
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.json.JSONObject

/** A manually invoked, one-request control in the separate Android test APK. */
@OptIn(PublicPreviewAPI::class)
class UnattestedPlannerProbe : Instrumentation() {
    override fun onCreate(arguments: Bundle?) {
        super.onCreate(arguments)
        if (arguments?.getString("sendOneUnattestedRequest") == "true") {
            start()
        } else {
            finish(Activity.RESULT_CANCELED, Bundle().apply { putString("outcome", "not-run") })
        }
    }

    override fun onStart() {
        var result = Activity.RESULT_CANCELED
        val evidence = Bundle()
        try {
            val config = targetContext.assets.open("viera-native-config.json").bufferedReader().use {
                JSONObject(it.readText())
            }
            val firebase = config.getJSONObject("firebase")
            check(targetContext.packageName == "com.vieralabs.energybalance")
            check(config.optBoolean("sparkBillingVerified"))
            check(firebase.getString("projectId") == "viera-energy-balance")
            val options = FirebaseOptions.Builder()
                .setApplicationId(firebase.getString("appId"))
                .setProjectId(firebase.getString("projectId"))
                .setApiKey(firebase.getString("apiKey"))
                .build()
            // The SDK resolves App Check on this isolated Firebase instance. No provider is installed.
            val app = FirebaseApp.initializeApp(targetContext, options, "viera-unattested-planner-qa")
            try {
                val model = FirebaseAI.getInstance(app, GenerativeBackend.googleAI()).generativeModel(
                    modelName = MODEL,
                    generationConfig = generationConfig { maxOutputTokens = 16 },
                    onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_IN_CLOUD)
                )
                evidence.putString("model", MODEL)
                runBlocking {
                    withTimeout(12000) { model.generateContent("Synthetic Viera QA. Reply with the word QA.") }
                }
                evidence.putString("outcome", "unexpected-success")
            } finally {
                app.delete()
            }
        } catch (error: Exception) {
            evidence.putString("exception", error.javaClass.simpleName)
            val message = error.message.orEmpty()
            val status = Regex("\\b(400|401|403)\\b").find(message)?.value
            // The Android SDK can preserve the proxy's message while omitting the HTTP status.
            val appCheckRejection = Regex(
                "(?i)(?:app[ -]?check|app attestation).{0,100}(?:missing|invalid|required|denied|failed|not provided)" +
                    "|(?:missing|invalid|required|denied|failed|without).{0,100}(?:app[ -]?check|app attestation)"
            ).containsMatchIn(message)
            val explicitlyRejected = error is ServerException && appCheckRejection
            if (status != null) evidence.putString("httpStatus", status)
            if (appCheckRejection) evidence.putString("serverReason", "app-check-attestation")
            val otherReason = when {
                message.contains("API key", ignoreCase = true) -> "api-key"
                message.contains("not found", ignoreCase = true) -> "endpoint-or-model-not-found"
                message.contains("permission", ignoreCase = true) -> "permission-unspecified"
                message.contains("unauthenticated", ignoreCase = true) -> "authentication-unspecified"
                else -> null
            }
            if (!appCheckRejection && otherReason != null) evidence.putString("serverReason", otherReason)
            evidence.putString("outcome", if (explicitlyRejected) "app-check-rejected" else "inconclusive")
            if (explicitlyRejected) result = Activity.RESULT_OK
        }
        finish(result, evidence)
    }

    private companion object {
        const val MODEL = "gemini-3.5-flash-lite"
    }
}
