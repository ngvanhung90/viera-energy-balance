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
import android.view.WindowInsets
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
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

private data class NearbyLocationRequest(val id: String, val reply: (JSONObject) -> Unit)

class MainActivity : Activity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val locationHandler = Handler(Looper.getMainLooper())
    private var locationCancellation: CancellationSignal? = null
    private var locationRequest: NearbyLocationRequest? = null
    private var permissionPending = false
    private var resumed = false
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
                        openExternalLink(url)
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
                    requestNearbyLocation(id) { result ->
                        reply.postMessage(result.put("id", id).toString())
                    }
                    return@addWebMessageListener
                }
                if (payload.optString("operation") == "cancel-nearby-location") {
                    if (locationRequest?.id == id) finishLocation()
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

    private fun openExternalLink(url: Uri) {
        if (url.host == "www.google.com" && url.path == "/maps/dir/") {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, url).setPackage("com.google.android.apps.maps"))
                return
            } catch (_: ActivityNotFoundException) {
                // A browser can show the same directions if Maps is unavailable.
            }
        }
        try {
            startActivity(Intent(Intent.ACTION_VIEW, url))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.live_external_browser, Toast.LENGTH_SHORT).show()
        }
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

    private fun granted(permission: String): Boolean =
        checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun requestNearbyLocation(id: String, reply: (JSONObject) -> Unit) {
        if (locationRequest != null || permissionPending || !resumed || !web.hasWindowFocus()) {
            reply(JSONObject().put("reason", "location-unavailable"))
            return
        }
        locationRequest = NearbyLocationRequest(id, reply)
        if (granted(Manifest.permission.ACCESS_FINE_LOCATION) || granted(Manifest.permission.ACCESS_COARSE_LOCATION)) {
            readNearbyLocation()
            return
        }
        permissionPending = true
        requestPermissions(
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
            locationPermission
        )
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, results: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, results)
        if (requestCode != locationPermission) return
        permissionPending = false
        if (locationRequest == null) return
        if (results.none { it == PackageManager.PERMISSION_GRANTED }) {
            finishLocation(reason = "location-denied")
            return
        }
        readNearbyLocation()
    }

    @SuppressLint("MissingPermission")
    private fun readNearbyLocation() {
        if (!resumed || permissionPending || locationRequest == null || locationCancellation != null) return
        val precise = granted(Manifest.permission.ACCESS_FINE_LOCATION)
        if (!precise && !granted(Manifest.permission.ACCESS_COARSE_LOCATION)) {
            finishLocation(reason = "location-denied")
            return
        }
        val manager = getSystemService(LocationManager::class.java)
        try {
            if (!LocationManagerCompat.isLocationEnabled(manager)) {
                finishLocation(reason = "location-disabled")
                return
            }
            val provider = when {
                precise && Build.VERSION.SDK_INT >= 31 && manager.isProviderEnabled(LocationManager.FUSED_PROVIDER) ->
                    LocationManager.FUSED_PROVIDER
                precise && manager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
                manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
                Build.VERSION.SDK_INT >= 31 && manager.isProviderEnabled(LocationManager.FUSED_PROVIDER) ->
                    LocationManager.FUSED_PROVIDER
                else -> null
            }
            if (provider == null) {
                finishLocation()
                return
            }
            val fineFixRequested = precise && provider != LocationManager.NETWORK_PROVIDER
            val signal = CancellationSignal()
            locationCancellation = signal
            locationHandler.postDelayed(locationDeadline, if (fineFixRequested) 15000 else 9000)
            LocationManagerCompat.getCurrentLocation(manager, provider, signal, ContextCompat.getMainExecutor(this)) { fix ->
                if (locationCancellation === signal) finishLocation(fix, fineFixRequested)
            }
        } catch (_: SecurityException) {
            finishLocation(reason = "location-denied")
        } catch (_: IllegalArgumentException) {
            finishLocation()
        }
    }

    private fun finishLocation(location: Location? = null, precise: Boolean = false, reason: String = "location-unavailable") {
        locationHandler.removeCallbacks(locationDeadline)
        val signal = locationCancellation
        locationCancellation = null
        signal?.cancel()
        val request = locationRequest
        locationRequest = null
        val result = if (location != null && location.hasAccuracy() && location.accuracy.isFinite()) {
            JSONObject().put("lat", location.latitude).put("lng", location.longitude)
                .put("accuracy", location.accuracy.toDouble()).put("precise", precise)
        } else {
            JSONObject().put("reason", reason)
        }
        request?.reply?.invoke(result)
    }

    override fun onResume() {
        super.onResume()
        resumed = true
        readNearbyLocation()
    }

    override fun onPause() {
        resumed = false
        if (locationCancellation != null) finishLocation()
        super.onPause()
    }

    override fun onDestroy() {
        scope.cancel()
        locationRequest = null
        finishLocation()
        web.destroy()
        super.onDestroy()
    }
}
