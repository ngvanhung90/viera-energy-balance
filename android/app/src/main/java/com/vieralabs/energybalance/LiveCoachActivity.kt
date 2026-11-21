package com.vieralabs.energybalance

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.TextureView
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.CheckBox
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import com.google.firebase.ai.type.InlineData
import com.google.firebase.ai.type.LiveSession
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.SessionResumptionConfig
import com.google.firebase.ai.type.liveAudioConversationConfig
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull

@OptIn(PublicPreviewAPI::class)
internal class LiveCoachActivity : Activity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val closeScope = CoroutineScope(Dispatchers.Main.immediate)
    private val cream = Color.rgb(246, 245, 235)
    private val green = Color.rgb(21, 53, 42)
    private val dark = Color.rgb(16, 37, 32)
    private val amber = Color.rgb(220, 238, 164)
    private lateinit var coach: NativeCoach
    private lateinit var content: LinearLayout
    private lateinit var status: TextView
    private lateinit var caption: TextView
    private lateinit var preview: TextureView
    private lateinit var placeholder: TextView
    private lateinit var cameraButton: Button
    private lateinit var muteButton: Button
    private lateinit var joinButton: Button
    private lateinit var pauseButton: Button
    private lateinit var consent: CheckBox
    private lateinit var setup: LinearLayout
    private val fitness by lazy { intent.getStringExtra("mode") == "fitness" }
    private val preferences by lazy { getSharedPreferences("viera-live-fitness", Context.MODE_PRIVATE) }
    private var fitnessChoices = emptyList<Spinner>()
    private var session: LiveSession? = null
    private var camera: LiveCamera? = null
    private var connection: Job? = null
    private var frames: Job? = null
    private var monitor: Job? = null
    private var mic = false
    private var paused = false
    private var interrupted = false
    private var foreground = false
    private var pausedMic = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        coach = NativeCoach(this)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.statusBarColor = cream
        window.navigationBarColor = cream
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        val scroll = ScrollView(this).apply { setBackgroundColor(cream); isFillViewport = true }
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(18), dp(20), dp(20))
        }
        scroll.addView(content)
        if (Build.VERSION.SDK_INT >= 35) {
            scroll.setOnApplyWindowInsetsListener { view, insets ->
                val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
                WindowInsets.CONSUMED
            }
        }
        setContentView(scroll)
        buildScreen()
        refresh()
    }

    private fun buildScreen() {
        addText(content, "VIERA ENERGY BALANCE", 12).apply {
            letterSpacing = .15f
            typeface = Typeface.DEFAULT_BOLD
        }
        addText(content, if (fitness) "Live Fitness Coach" else "Live Cooking Coach", 33, 8).apply {
            typeface = Typeface.create("serif", Typeface.NORMAL)
        }
        addText(content, "Gemini Live · Cloud · ${NativeCoach.LIVE_MODEL}", 12, 5)
        val frame = FrameLayout(this).apply {
            background = rounded(dark, 23)
            clipToOutline = true
        }
        preview = TextureView(this)
        frame.addView(preview, FrameLayout.LayoutParams(-1, -1))
        placeholder = TextView(this).apply {
            text = "Camera off"
            textSize = 18f
            gravity = Gravity.CENTER
            setTextColor(cream)
        }
        frame.addView(placeholder, FrameLayout.LayoutParams(-1, -1))
        content.addView(frame, LinearLayout.LayoutParams(-1, dp(200)).apply { topMargin = dp(16) })
        status = addText(content, "", 15, 12).apply {
            typeface = Typeface.DEFAULT_BOLD
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        caption = addText(content, "", 16, 6).apply { visibility = View.GONE }
        val media = row()
        cameraButton = action(media, "Share camera") { cameraToggle() }
        muteButton = action(media, "Mute mic") { audioToggle() }
        val controls = row()
        pauseButton = action(controls, "Pause call") { pauseToggle() }
        action(controls, "End / close") { finish() }

        setup = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(setup)
        if (fitness) buildFitnessForm()
        consent = CheckBox(this).apply {
            text = "For this call, I agree to share demo audio and any camera frames I turn on with Google Gemini Free tier. Google may use them to improve its services. Use sample ingredients or demonstration movements and keep health details, faces and private material out of the call."
            textSize = 14f
            setTextColor(dark)
            setPadding(0, dp(10), 0, dp(10))
            setOnCheckedChangeListener { _, _ -> refresh() }
        }
        setup.addView(consent)
        joinButton = Button(this).apply {
            text = "Start Live call"
            isAllCaps = false
            background = rounded(amber, 15)
            setTextColor(dark)
            setOnClickListener { requestToJoin() }
        }
        setup.addView(joinButton, LinearLayout.LayoutParams(-1, dp(48)))
        addText(content, "Audio and frames are shared only for your Live call. Viera stores no recordings or transcripts.", 12, 10)
    }

    private fun buildFitnessForm() {
        addText(setup, "Your session", 20, 14)
        fitnessChoices = listOf(
            picker("Activity", "activity", listOf("Walking", "Yoga", "Stretching", "Cardio", "Strength")),
            picker("Effort", "effort", listOf("Light", "Moderate", "Vigorous")),
            picker("Duration", "duration", listOf("10 minutes", "20 minutes", "30 minutes", "45 minutes")),
            picker("Energy target (estimated)", "target", listOf("No target", "50 kcal", "100 kcal", "150 kcal", "200 kcal")),
            picker("Equipment", "equipment", listOf("No equipment", "Mat", "Chair", "Resistance band", "Dumbbells")),
            picker("Gender · optional, on device", "gender", listOf("Prefer not to say", "Woman", "Man", "Non-binary", "Another identity")),
            picker("Comfort level · on device", "capacity", listOf("Start gently", "Comfortable with activity", "Experienced")),
            picker("Movement limits · on device", "limits", listOf("None selected", "Stay seated", "Avoid impact", "Avoid floor work"))
        )
        val button = Button(this).apply {
            text = "Save workout preferences"
            isAllCaps = false
            setOnClickListener {
                saveFitness()
                status.text = "Workout preferences saved on this device."
            }
        }
        setup.addView(button)
        addText(setup, "Energy estimates vary by body and effort. Use the camera for conversation, not as a safety check.", 13, 4)
    }

    private fun picker(label: String, key: String, values: List<String>): Spinner {
        val input = Spinner(this).apply {
            id = View.generateViewId()
            tag = key
            val choices = ArrayAdapter(this@LiveCoachActivity, android.R.layout.simple_spinner_item, values)
            choices.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            adapter = choices
            val default = when (key) {
                "activity" -> when (intent.getStringExtra("context")) {
                    "stretch" -> 2
                    "cycle", "jog" -> 3
                    else -> 0
                }
                "duration" -> 1
                else -> 0
            }
            setSelection(preferences.getInt(key, default).coerceIn(values.indices))
        }
        addText(setup, label, 13, 8).labelFor = input.id
        setup.addView(input, LinearLayout.LayoutParams(-1, dp(44)))
        return input
    }

    private fun saveFitness() {
        preferences.edit().also { edit ->
            fitnessChoices.forEach { edit.putInt(it.tag as String, it.selectedItemPosition) }
        }.apply()
    }

    private fun instruction(): String {
        val common = "You are Viera's voice coach in a synthetic demo. Speak in the user's language. " +
            "Give one short actionable step at a time, then invite a spoken follow-up. " +
            "Use only clearly visible camera evidence. If uncertain, ask. Don't infer identity or health from appearance. " +
            "Do not ask for personal, demographic or medical information."
        if (!fitness) {
            val recipe = intent.getStringExtra("context").orEmpty().take(2400)
            return "$common Guide cooking this curated recipe: $recipe. Offer substitutions and portion guidance. " +
                "Never infer food safety by sight. For allergies or safe cooking temperatures suggest checking labels or using a thermometer."
        }
        val values = fitnessChoices.associate { (it.tag as String) to it.selectedItem.toString() }
        val format = when (values["limits"]) {
            "Stay seated" -> "use a chair-based routine"
            "Avoid impact" -> "use low-impact movements"
            "Avoid floor work" -> "use only standing or seated movements"
            else -> "offer low-impact alternatives"
        }
        val effort = if (values["capacity"] == "Start gently" || values["limits"] != "None selected") "Light" else values["effort"]
        return "$common Guide this sample workout: ${values["activity"]}, $effort effort, ${values["duration"]}, $format. " +
            "${values["target"]} only as an approximate preference, with ${values["equipment"]}. " +
            "Include a warm-up, short rest options and a lower-effort alternative. Ask about preferred moves, without collecting health data. " +
            "Do not give diagnoses, guarantee posture safety or claim exact calorie burn. If discomfort is mentioned, advise pausing."
    }

    private fun requestToJoin() {
        if (!consent.isChecked || !coach.liveConfigured() || connection != null || session != null) return
        if (!allowed(Manifest.permission.RECORD_AUDIO)) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), MIC_PERMISSION)
        } else join()
    }

    @SuppressLint("MissingPermission")
    private fun join() {
        if (!foreground || !consent.isChecked || !allowed(Manifest.permission.RECORD_AUDIO)) return
        if (fitness) saveFitness()
        connection = scope.launch(start = CoroutineStart.LAZY) {
            status.text = "Checking App Check and connecting…"
            try {
                val model = coach.liveModel(instruction())
                val connected = withTimeout(15000) { model.connect(SessionResumptionConfig()) }
                session = connected
                startAudio(connected)
                status.text = "Connected · Firebase AI Logic"
                withTimeout(5000) {
                    connected.sendTextRealtime("Start with a short greeting and the first step; then wait for my voice question.")
                }
                watchConnection(connected)
            } catch (error: TimeoutCancellationException) {
                endSession()
                status.text = "Connection timed out. Try again."
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                endSession()
                status.text = failure(error)
            } finally {
                connection = null
                refresh()
            }
        }
        connection?.start()
        refresh()
    }

    @SuppressLint("MissingPermission")
    private suspend fun startAudio(connected: LiveSession) {
        check(foreground && allowed(Manifest.permission.RECORD_AUDIO))
        connected.startAudioConversation(liveAudioConversationConfig {
            transcriptHandler = { _, output ->
                scope.launch {
                    if (session === connected && output != null && !interrupted && !paused) {
                        caption.text = output.text.orEmpty().take(400)
                        caption.visibility = if (caption.text.isBlank()) View.GONE else View.VISIBLE
                    }
                }
            }
            goAwayHandler = { scope.launch { if (session === connected) interruptCall() } }
        })
        mic = true
    }

    private fun watchConnection(connected: LiveSession) {
        monitor?.cancel()
        monitor = scope.launch {
            while (isActive && session === connected && !interrupted) {
                delay(1000)
                if (connected.isClosed()) interruptCall()
            }
        }
    }

    private fun interruptCall() {
        if (interrupted || session == null) return
        stopCamera()
        stopAudio()
        interrupted = true
        paused = false
        status.text = "Connection interrupted. Resume to reconnect, or close the call."
        refresh()
    }

    private fun audioToggle() {
        val connected = session ?: return
        if (paused || interrupted || connection != null) return
        if (mic) {
            stopAudio()
            refresh()
        } else if (allowed(Manifest.permission.RECORD_AUDIO)) {
            restartAudio(connected, reconnect = false)
        } else status.text = "Android microphone permission is required to resume audio."
    }

    private fun pauseToggle() {
        val connected = session ?: return
        if (connection != null) return
        if (interrupted || paused) {
            restartAudio(connected, reconnect = interrupted)
        } else {
            pausedMic = mic
            stopAudio()
            stopCamera()
            paused = true
            status.text = "Paused · microphone and camera are off."
            refresh()
        }
    }

    private fun restartAudio(connected: LiveSession, reconnect: Boolean) {
        val restoreAudio = !paused || pausedMic
        connection = scope.launch(start = CoroutineStart.LAZY) {
            try {
                if (reconnect) {
                    status.text = "Reconnecting Live…"
                    withTimeout(12000) { connected.resumeSession() }
                }
                if (restoreAudio) startAudio(connected)
                paused = false
                interrupted = false
                status.text = "Connected · camera is off until you share it."
                watchConnection(connected)
            } catch (error: TimeoutCancellationException) {
                endSession()
                status.text = "Resume timed out. Start a new call when ready."
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                endSession()
                status.text = "The previous Live session could not resume. Start a new call when ready."
            } finally {
                connection = null
                refresh()
            }
        }
        connection?.start()
        refresh()
    }

    private fun stopAudio() {
        session?.takeIf { it.isAudioConversationActive() }?.stopAudioConversation()
        mic = false
    }

    private fun cameraToggle() {
        if (!canStream()) return
        if (camera != null) {
            stopCamera()
            refresh()
        } else if (!allowed(Manifest.permission.CAMERA)) {
            requestPermissions(arrayOf(Manifest.permission.CAMERA), CAMERA_PERMISSION)
        } else startCamera()
    }

    private fun startCamera() {
        val connected = session ?: return
        if (!canStream() || !allowed(Manifest.permission.CAMERA)) return
        preview.alpha = 1f
        placeholder.text = "Starting camera…"
        camera = LiveCamera(this, preview, front = fitness,
            onReady = {
                placeholder.visibility = View.GONE
                frames = scope.launch {
                    while (isActive && canStream()) {
                        delay(1000)
                        if (!canStream() || !allowed(Manifest.permission.CAMERA)) break
                        val bitmap = preview.getBitmap(480, 360) ?: continue
                        val jpeg = try {
                            withContext(Dispatchers.Default) {
                                ByteArrayOutputStream().use { output ->
                                    bitmap.compress(Bitmap.CompressFormat.JPEG, 68, output)
                                    output.toByteArray()
                                }
                            }
                        } finally {
                            bitmap.recycle()
                        }
                        try {
                            if (canStream() && camera != null && session === connected && jpeg.isNotEmpty()) {
                                withTimeout(5000) { connected.sendVideoRealtime(InlineData(jpeg, "image/jpeg")) }
                            }
                        } catch (_: TimeoutCancellationException) {
                            interruptCall()
                        } catch (cancelled: CancellationException) {
                            throw cancelled
                        } catch (_: Exception) {
                            interruptCall()
                        }
                    }
                }
            },
            onError = {
                stopCamera()
                status.text = "Camera unavailable. You can continue with voice."
                refresh()
            }
        )
        camera?.start()
        refresh()
    }

    private fun stopCamera() {
        frames?.cancel()
        frames = null
        camera?.close()
        camera = null
        preview.alpha = 0f
        placeholder.text = "Camera off"
        placeholder.visibility = View.VISIBLE
    }

    private fun canStream() = foreground && session != null && !paused && !interrupted && consent.isChecked
    private fun allowed(permission: String) = checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, results)
        if (results.firstOrNull() != PackageManager.PERMISSION_GRANTED) {
            status.text = if (requestCode == MIC_PERMISSION) "Microphone permission was declined." else "Camera permission was declined."
            return
        }
        when (requestCode) {
            MIC_PERMISSION -> join()
            CAMERA_PERMISSION -> startCamera()
        }
    }

    private fun failure(error: Exception): String {
        val detail = error.message.orEmpty()
        return when {
            detail == "app-check" -> "App Check could not verify this installation."
            detail == "offline" -> "Gemini Live needs an internet connection."
            detail == "live-not-configured" -> "Gemini Live is not enabled for this build."
            Regex("429|quota|resource.exhausted", RegexOption.IGNORE_CASE).containsMatchIn(detail) ->
                "Gemini Live reached its free quota. Try later."
            else -> "Gemini Live could not connect. Check your connection and project setup."
        }
    }

    private fun refresh() {
        val connected = session != null
        setup.visibility = if (connected) View.GONE else View.VISIBLE
        if (!connected && status.text.isBlank()) {
            status.text = if (coach.liveConfigured()) "Ready · camera and microphone off"
                else "Live is unavailable until the Viera Spark project and Live quota are verified."
        }
        joinButton.isEnabled = coach.liveConfigured() && consent.isChecked && connection == null
        cameraButton.isEnabled = connected && !paused && !interrupted && connection == null
        muteButton.isEnabled = cameraButton.isEnabled
        pauseButton.isEnabled = connected && connection == null
        cameraButton.text = if (camera == null) "Share camera" else "Turn camera off"
        muteButton.text = if (mic) "Mute mic" else "Enable mic"
        pauseButton.text = if (paused || interrupted) "Resume call" else "Pause call"
    }

    private fun endSession() {
        monitor?.cancel()
        monitor = null
        stopCamera()
        stopAudio()
        val previous = session
        session = null
        if (previous != null) closeScope.launch {
            withContext(NonCancellable) { withTimeoutOrNull(3000) { runCatching { previous.close() } } }
        }
        paused = false
        interrupted = false
        caption.text = ""
        caption.visibility = View.GONE
    }

    override fun onStart() {
        super.onStart()
        foreground = true
    }

    override fun onStop() {
        foreground = false
        connection?.cancel()
        connection = null
        val wasActive = session != null
        endSession()
        if (wasActive) {
            consent.isChecked = false
            status.text = "Call ended when Viera left the foreground."
        }
        refresh()
        super.onStop()
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun row() = LinearLayout(this).also {
        content.addView(it, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) })
    }

    private fun action(row: LinearLayout, label: String, click: () -> Unit): Button =
        Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { click() }
            row.addView(this, LinearLayout.LayoutParams(0, dp(48), 1f))
        }

    private fun addText(parent: LinearLayout, label: String, size: Int, margin: Int = 0) =
        TextView(this).apply {
            text = label
            textSize = size.toFloat()
            setTextColor(green)
            parent.addView(this, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(margin) })
        }

    private fun rounded(color: Int, radius: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radius).toFloat()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density + .5f).toInt()

    companion object {
        private const val MIC_PERMISSION = 21
        private const val CAMERA_PERMISSION = 22
    }
}
