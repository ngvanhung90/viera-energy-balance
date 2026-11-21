package com.vieralabs.energybalance

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.WindowInsets
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject

private const val origin = "https://appassets.androidplatform.net"

class MainActivity : Activity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var web: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        val coach = NativeCoach(this)
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.userAgentString += " VieraAndroid/1"
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    loader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    if (!request.isForMainFrame) return false
                    val url = request.url
                    if (url.scheme == "https" && url.host == "appassets.androidplatform.net") return false
                    if (url.scheme == "https" && url.host in setOf("www.youtube.com", "www.google.com", "fdc.nal.usda.gov", "pacompendium.com")) {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, url))
                        } catch (_: ActivityNotFoundException) {
                            Toast.makeText(this@MainActivity, "No browser is available", Toast.LENGTH_SHORT).show()
                        }
                    }
                    return true
                }
            }
        }
        if (Build.VERSION.SDK_INT >= 35) {
            web.setOnApplyWindowInsetsListener { view, insets ->
                val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
                WindowInsets.CONSUMED
            }
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "VieraNative", setOf(origin)) { _, message, source, mainFrame, reply ->
                if (!mainFrame || source != Uri.parse(origin)) return@addWebMessageListener
                val payload = message.data?.let { runCatching { JSONObject(it) }.getOrNull() }
                    ?: return@addWebMessageListener
                val id = payload.optString("id").takeIf { it.length in 1..32 }
                    ?: return@addWebMessageListener
                if (payload.optString("operation") == "open-live") {
                    val mode = payload.optString("mode")
                    if (mode == "cooking" || mode == "fitness") {
                        startActivity(Intent(this, LiveCoachActivity::class.java)
                            .putExtra("mode", mode)
                            .putExtra("context", payload.optString("context").take(2400)))
                    }
                    return@addWebMessageListener
                }
                scope.launch {
                    val result = coach.run(payload).put("id", id)
                    reply.postMessage(result.toString())
                }
            }
        }
        setContentView(web)
        web.loadUrl("$origin/assets/index.html")
    }

    override fun onDestroy() {
        scope.cancel()
        web.destroy()
        super.onDestroy()
    }
}
