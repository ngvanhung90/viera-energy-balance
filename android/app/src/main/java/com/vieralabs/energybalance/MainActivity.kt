package com.vieralabs.energybalance

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
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
private const val locationPermission = 1080

class MainActivity : Activity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val locationHandler = Handler(Looper.getMainLooper())
    private var locationCancellation: CancellationSignal? = null
    private var locationReply: ((JSONObject) -> Unit)? = null
    private val locationDeadline = Runnable { finishLocation() }
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
            val languageTags = resources.configuration.locales.toLanguageTags()
            settings.userAgentString += " VieraAndroid/1 VieraLocale/$languageTags"
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    loader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    if (!request.isForMainFrame) return false
                    val url = request.url
                    if (url.scheme == "https" && url.host == "appassets.androidplatform.net") return false
                    if (url.scheme == "https" && (url.host in setOf("www.youtube.com", "www.google.com", "fdc.nal.usda.gov", "pacompendium.com")
                            || nearbySource(url))) {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, url))
                        } catch (_: ActivityNotFoundException) {
                            Toast.makeText(this@MainActivity, R.string.live_external_browser, Toast.LENGTH_SHORT).show()
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
                if (payload.optString("operation") == "nearby-location") {
                    requestNearbyLocation { result -> reply.postMessage(result.put("id", id).toString()) }
                    return@addWebMessageListener
                }
                if (payload.optString("operation") == "open-live") {
                    val mode = payload.optString("mode")
                    if (mode == "cooking" || mode == "fitness") {
                        startActivity(Intent(this, LiveCoachActivity::class.java)
                            .putExtra("mode", mode)
                            .putExtra("context", payload.optString("context").take(2400))
                            .putExtra("recipeId", payload.optString("recipeId").take(40))
                            .putExtra("subject", payload.optString("subject").take(120))
                            .putStringArrayListExtra("steps", ArrayList<String>().apply {
                                val steps = payload.optJSONArray("steps") ?: return@apply
                                repeat(steps.length().coerceAtMost(10)) { add(steps.optString(it).take(120)) }
                            }))
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

    private fun nearbySource(uri: Uri): Boolean = when (uri.host) {
        "propagandabistros.com", "atasteofsaigon.vn" -> uri.path?.let {
            it.startsWith("/wp-content/uploads/") && it.endsWith(".pdf")
        } == true
        "bepcuon.net" -> uri.path == "/thuc-don/"
        "secretgardensaigon.com" -> uri.path == "/"
        "amalfitana-paris.com" -> uri.path == "/fr/menu/notre-carte"
        "www.restaurant-amalfi.fr" -> uri.path == "/carte-pates-fraiches-paris-12/"
        "www.dongiovanniparis.com" -> uri.path == "/carte"
        "www.openstreetmap.org" -> uri.path == "/copyright"
            || uri.path?.matches(Regex("/(node|way|relation)/[0-9]+")) == true
        else -> false
    }

    private fun requestNearbyLocation(reply: (JSONObject) -> Unit) {
        if (locationReply != null || !web.hasWindowFocus()) {
            reply(JSONObject().put("reason", "location-unavailable"))
            return
        }
        locationReply = reply
        if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            readNearbyLocation()
        } else {
            requestPermissions(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION), locationPermission)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, results: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, results)
        if (requestCode != locationPermission || locationReply == null) return
        if (results.firstOrNull() == PackageManager.PERMISSION_GRANTED) readNearbyLocation()
        else finishLocation(reason = "location-denied")
    }

    @SuppressLint("MissingPermission")
    private fun readNearbyLocation() {
        val manager = getSystemService(LocationManager::class.java)
        val provider = LocationManager.NETWORK_PROVIDER
        try {
            if (!manager.isProviderEnabled(provider)) {
                finishLocation()
                return
            }
            if (Build.VERSION.SDK_INT >= 30) {
                val signal = CancellationSignal()
                locationCancellation = signal
                locationHandler.postDelayed(locationDeadline, 9000)
                manager.getCurrentLocation(provider, signal, mainExecutor) { location ->
                    if (locationCancellation === signal) finishLocation(location)
                }
            } else {
                val recent = manager.getLastKnownLocation(provider)?.takeIf {
                    SystemClock.elapsedRealtimeNanos() - it.elapsedRealtimeNanos in 0..120_000_000_000L
                }
                finishLocation(recent)
            }
        } catch (_: SecurityException) {
            finishLocation(reason = "location-denied")
        } catch (_: IllegalArgumentException) {
            finishLocation()
        }
    }

    private fun finishLocation(location: Location? = null, reason: String = "location-unavailable") {
        locationHandler.removeCallbacks(locationDeadline)
        val signal = locationCancellation
        locationCancellation = null
        signal?.cancel()
        val reply = locationReply
        locationReply = null
        val result = if (location != null && location.hasAccuracy() && location.accuracy.isFinite()) {
            JSONObject().put("lat", location.latitude).put("lng", location.longitude).put("accuracy", location.accuracy.toDouble())
        } else {
            JSONObject().put("reason", reason)
        }
        reply?.invoke(result)
    }

    override fun onStop() {
        if (locationCancellation != null) finishLocation()
        super.onStop()
    }

    override fun onDestroy() {
        scope.cancel()
        locationReply = null
        finishLocation()
        web.destroy()
        super.onDestroy()
    }
}
