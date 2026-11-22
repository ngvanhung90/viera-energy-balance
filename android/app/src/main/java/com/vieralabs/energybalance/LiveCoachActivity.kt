package com.vieralabs.energybalance

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.TextureView
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.widget.ArrayAdapter
import android.widget.AdapterView
import android.widget.Button
import android.widget.CheckBox
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import com.google.firebase.ai.type.InlineData
import com.google.firebase.ai.type.InlineDataPart
import com.google.firebase.ai.type.LiveServerContent
import com.google.firebase.ai.type.LiveServerGoAway
import com.google.firebase.ai.type.LiveServerVoiceActivity
import com.google.firebase.ai.type.LiveSession
import com.google.firebase.ai.type.LiveSessionResumptionUpdate
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.SessionResumptionConfig
import com.google.firebase.ai.type.VoiceActivityType
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
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.flowOn
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
    private lateinit var stepLabel: TextView
    private lateinit var subjectLabel: TextView
    private lateinit var previousStep: Button
    private lateinit var nextStep: Button
    private var step = 0
    private val fitness by lazy { intent.getStringExtra("mode") == "fitness" }
    private val preferences by lazy { getSharedPreferences("viera-live-fitness", Context.MODE_PRIVATE) }
    private var fitnessChoices = emptyList<Spinner>()
    private var session: LiveSession? = null
    private var camera: LiveCamera? = null
    private var connection: Job? = null
    private var frames: Job? = null
    private var receiver: Job? = null
    private var audio: LiveVoiceAudio? = null
    private var audioGeneration = 0
    private var resumptionHandle: String? = null
    private var mic = false
    private var paused = false
    private var interrupted = false
    private var foreground = false
    private var pausedMic = false
    private var inputObserved = false
    private var outputObserved = false
    private var modelAudioObserved = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        volumeControlStream = AudioManager.STREAM_MUSIC
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
        restoreProgress()
        refresh()
    }

    private fun buildScreen() {
        addText(content, "VIERA ENERGY BALANCE", 12).apply {
            letterSpacing = .15f
            typeface = Typeface.DEFAULT_BOLD
        }
        addText(content, if (fitness) getString(R.string.live_fitness) else getString(R.string.live_cooking), 33, 8).apply {
            typeface = Typeface.create("serif", Typeface.NORMAL)
        }
        addText(content, getString(R.string.live_model, NativeCoach.LIVE_MODEL), 12, 5)
        subjectLabel = addText(content, "", 19, 12).apply { typeface = Typeface.DEFAULT_BOLD }
        stepLabel = addText(content, "", 16, 5).apply {
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        val progressButtons = row()
        previousStep = action(progressButtons, getString(R.string.live_previous_step)) { moveStep(-1) }
        nextStep = action(progressButtons, getString(R.string.live_next_step)) { moveStep(1) }
        val frame = FrameLayout(this).apply {
            background = rounded(dark, 23)
            clipToOutline = true
        }
        preview = TextureView(this)
        frame.addView(preview, FrameLayout.LayoutParams(-1, -1))
        placeholder = TextView(this).apply {
            text = getString(R.string.live_camera_off)
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
        cameraButton = action(media, getString(R.string.live_camera_share)) { cameraToggle() }
        muteButton = action(media, getString(R.string.live_mute)) { audioToggle() }
        val controls = row()
        pauseButton = action(controls, getString(R.string.live_pause)) { pauseToggle() }
        action(controls, getString(R.string.live_end)) { finish() }

        setup = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(setup)
        if (fitness) buildFitnessForm()
        consent = CheckBox(this).apply {
            text = getString(R.string.live_consent)
            textSize = 14f
            setTextColor(dark)
            setPadding(0, dp(10), 0, dp(10))
            setOnCheckedChangeListener { _, _ -> refresh() }
        }
        setup.addView(consent)
        joinButton = Button(this).apply {
            text = getString(R.string.live_start)
            isAllCaps = false
            background = rounded(amber, 15)
            setTextColor(dark)
            setOnClickListener { requestToJoin() }
        }
        setup.addView(joinButton, LinearLayout.LayoutParams(-1, dp(48)))
        addText(content, getString(R.string.live_privacy), 12, 10)
    }

    private fun buildFitnessForm() {
        addText(setup, getString(R.string.live_your_session), 20, 14)
        fitnessChoices = listOf(
            picker(getString(R.string.live_activity), "activity", resources.getStringArray(R.array.live_activities).toList()),
            picker(getString(R.string.live_effort), "effort", resources.getStringArray(R.array.live_efforts).toList()),
            picker(getString(R.string.live_duration), "duration", resources.getStringArray(R.array.live_durations).toList()),
            picker(getString(R.string.live_energy), "target", resources.getStringArray(R.array.live_targets).toList()),
            picker(getString(R.string.live_equipment), "equipment", resources.getStringArray(R.array.live_equipments).toList()),
            picker(getString(R.string.live_gender), "gender", resources.getStringArray(R.array.live_genders).toList()),
            picker(getString(R.string.live_capacity), "capacity", resources.getStringArray(R.array.live_capacities).toList()),
            picker(getString(R.string.live_limits), "limits", resources.getStringArray(R.array.live_restrictions).toList())
        )
        val button = Button(this).apply {
            text = getString(R.string.live_save)
            isAllCaps = false
            setOnClickListener {
                saveFitness()
                Toast.makeText(this@LiveCoachActivity, R.string.live_preferences_saved, Toast.LENGTH_SHORT).show()
            }
        }
        setup.addView(button)
        addText(setup, getString(R.string.live_fitness_note), 13, 4)
        fitnessChoices.first().onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>, view: View?, position: Int, id: Long) = restoreProgress()
            override fun onNothingSelected(parent: AdapterView<*>) = Unit
        }
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

    private fun steps(): List<String> = if (fitness) {
        resources.getStringArray(R.array.live_fitness_steps).toList()
    } else {
        intent.getStringArrayListExtra("steps").orEmpty().filter { it.isNotBlank() }
            .ifEmpty { listOf(getString(R.string.live_prepare_ingredients)) }
    }

    private fun progressKey(): String = if (fitness) {
        "step:fitness:${fitnessChoices.first().selectedItemPosition}"
    } else {
        "step:recipe:${intent.getStringExtra("recipeId").orEmpty()}"
    }

    private fun restoreProgress() {
        step = preferences.getInt(progressKey(), 0).coerceIn(steps().indices)
        renderProgress()
    }

    private fun renderProgress() {
        val plan = steps()
        subjectLabel.text = if (fitness) fitnessChoices.first().selectedItem.toString()
            else intent.getStringExtra("subject")?.takeIf { it.isNotBlank() }
                ?: getString(R.string.live_cooking)
        stepLabel.text = getString(R.string.live_current_step, step + 1, plan.size, plan[step])
        previousStep.isEnabled = step > 0
        nextStep.isEnabled = step < plan.lastIndex
    }

    private fun moveStep(offset: Int) {
        step = (step + offset).coerceIn(steps().indices)
        if (fitness) saveFitness()
        preferences.edit().putInt(progressKey(), step).apply()
        renderProgress()
        val connected = session?.takeIf { canStream() && mic } ?: return
        scope.launch {
            try {
                withTimeout(5000) {
                    connected.sendTextRealtime("The user moved to step ${step + 1}: ${steps()[step]}. Guide this step.")
                }
            } catch (_: TimeoutCancellationException) {
                interruptCall()
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                interruptCall()
            }
        }
    }

    private fun instruction(): String {
        val uiLanguage = resources.configuration.locales[0].toLanguageTag()
        val common = "You are Viera's voice coach in a synthetic demo. Start in the app language ($uiLanguage), " +
            "and switch to the user's spoken language if they ask. Start at saved step ${step + 1}: ${steps()[step]}. " +
            "Give one short actionable step at a time, then invite a spoken follow-up. " +
            "Use only clearly visible camera evidence. If uncertain, ask. Don't infer identity or health from appearance. " +
            "Do not ask for personal, demographic or medical information."
        if (!fitness) {
            val recipe = intent.getStringExtra("context").orEmpty().take(2400)
            return "$common Guide cooking this curated recipe: $recipe. Offer substitutions and portion guidance. " +
                "Never infer food safety by sight. For allergies or safe cooking temperatures suggest checking labels or using a thermometer."
        }
        val fields = fitnessChoices.associateBy { it.tag as String }
        val format = when (fields["limits"]?.selectedItemPosition) {
            1 -> "use a chair-based routine"
            2 -> "use low-impact movements"
            3 -> "use only standing or seated movements"
            else -> "offer low-impact alternatives"
        }
        val values = fields.mapValues { it.value.selectedItem.toString() }
        val effort = if (fields["capacity"]?.selectedItemPosition == 0 || fields["limits"]?.selectedItemPosition != 0) {
            getStringArrayItem(R.array.live_efforts, 0)
        } else values["effort"]
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
            status.text = getString(R.string.live_connecting)
            try {
                val model = coach.liveModel(instruction())
                val connected = withTimeout(15000) { model.connect(SessionResumptionConfig()) }
                session = connected
                startReceiving(connected)
                startAudio(connected)
                status.text = getString(R.string.live_connected)
                qaEvent("transport-connected")
            } catch (error: TimeoutCancellationException) {
                endSession()
                status.text = getString(R.string.live_connect_timeout)
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

    private fun startAudio(connected: LiveSession) {
        check(foreground && allowed(Manifest.permission.RECORD_AUDIO))
        val generation = ++audioGeneration
        audio = LiveVoiceAudio(
            scope,
            send = { bytes -> withTimeout(5000) { connected.sendAudioRealtime(InlineData(bytes, LiveVoiceAudio.INPUT_MIME)) } },
            event = ::qaEvent,
            failed = { reason -> scope.launch {
                if (session === connected && generation == audioGeneration && mic) {
                    qaEvent(reason)
                    when {
                        reason.startsWith("mic-send") -> interruptCall()
                        else -> {
                            stopAudio()
                            status.text = getString(if (reason.startsWith("speaker")) R.string.live_audio_output_failed
                                else R.string.live_audio_input_failed)
                            refresh()
                        }
                    }
                }
            } }
        ).also { it.start() }
        mic = true
    }

    private fun startReceiving(connected: LiveSession) {
        receiver = scope.launch {
            try {
                // The SDK polls its WebSocket. Keep that work off the UI and audio paths.
                connected.receive().flowOn(Dispatchers.IO).collect { message ->
                    if (session !== connected) return@collect
                    when (message) {
                        is LiveSessionResumptionUpdate -> {
                            if (message.resumable == true && !message.newHandle.isNullOrBlank()) {
                                if (resumptionHandle == null) qaEvent("resume-handle-received")
                                resumptionHandle = message.newHandle
                            }
                        }
                        is LiveServerVoiceActivity -> when (message.type) {
                            VoiceActivityType.ACTIVITY_START -> qaEvent("server-speech-start")
                            VoiceActivityType.ACTIVITY_END -> qaEvent("server-speech-end")
                            else -> Unit
                        }
                        is LiveServerGoAway -> interruptCall()
                        is LiveServerContent -> if (!interrupted && !paused) renderServerContent(message)
                        else -> Unit
                    }
                }
                qaEvent("server-receive-closed")
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                qaEvent("server-receive-error")
            } finally {
                if (isActive && session === connected) interruptCall()
            }
        }
    }

    private suspend fun renderServerContent(message: LiveServerContent) {
        if (!inputObserved && !message.inputTranscription?.text.isNullOrBlank()) {
            inputObserved = true
            qaEvent("input-transcribed")
        }
        message.outputTranscription?.let { output ->
            caption.text = output.text.orEmpty().take(400)
            caption.visibility = if (caption.text.isBlank()) View.GONE else View.VISIBLE
            if (!outputObserved && caption.text.isNotBlank()) {
                outputObserved = true
                qaEvent("output-transcribed")
            }
        }
        if (message.turnComplete) qaEvent("server-turn-complete")
        if (message.interrupted) {
            audio?.discardPlayback()
            return
        }
        for (part in message.content?.parts.orEmpty().filterIsInstance<InlineDataPart>()) {
            if (!part.mimeType.startsWith("audio/pcm", ignoreCase = true)) continue
            if (!modelAudioObserved && part.inlineData.isNotEmpty()) {
                modelAudioObserved = true
                qaEvent("model-pcm-received")
            }
            audio?.play(part.inlineData)
        }
    }

    private fun interruptCall() {
        if (interrupted || session == null) return
        if (!paused) pausedMic = mic
        stopCamera()
        stopAudio()
        interrupted = true
        paused = false
        status.text = getString(R.string.live_interrupted)
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
        } else status.text = getString(R.string.live_mic_needed)
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
            status.text = getString(R.string.live_paused)
            refresh()
        }
    }

    private fun restartAudio(connected: LiveSession, reconnect: Boolean) {
        val restoreAudio = if (paused || reconnect) pausedMic else true
        connection = scope.launch(start = CoroutineStart.LAZY) {
            try {
                if (reconnect) {
                    status.text = getString(R.string.live_reconnecting)
                    val handle = checkNotNull(resumptionHandle)
                    connected.stopReceiving()
                    receiver?.cancelAndJoin()
                    withTimeout(12000) { connected.resumeSession(SessionResumptionConfig(handle)) }
                    qaEvent("resume-with-handle-connected")
                    startReceiving(connected)
                }
                if (restoreAudio) startAudio(connected)
                paused = false
                interrupted = false
                status.text = getString(R.string.live_camera_remains_off)
            } catch (error: TimeoutCancellationException) {
                endSession()
                status.text = getString(R.string.live_resume_timeout)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                endSession()
                status.text = getString(R.string.live_resume_failed)
            } finally {
                connection = null
                refresh()
            }
        }
        connection?.start()
        refresh()
    }

    private fun stopAudio() {
        audioGeneration++
        audio?.stop()
        audio = null
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
        placeholder.text = getString(R.string.live_camera_starting)
        camera = LiveCamera(this, preview, front = fitness,
            onReady = {
                placeholder.visibility = View.GONE
                frames = scope.launch {
                    var firstFrameSent = false
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
                                if (!firstFrameSent) {
                                    firstFrameSent = true
                                    qaEvent("camera-frame-sent")
                                }
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
                status.text = getString(R.string.live_camera_unavailable)
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
        placeholder.text = getString(R.string.live_camera_off)
        placeholder.visibility = View.VISIBLE
    }

    private fun canStream() = foreground && session != null && !paused && !interrupted && consent.isChecked
    private fun allowed(permission: String) = checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun qaEvent(event: String) {
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            Log.i("VieraLiveQA", "${if (fitness) "fitness" else "cooking"}: $event")
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, results)
        if (results.firstOrNull() != PackageManager.PERMISSION_GRANTED) {
            status.text = if (requestCode == MIC_PERMISSION) getString(R.string.live_mic_denied) else getString(R.string.live_camera_denied)
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
            detail == "app-check" -> getString(R.string.live_attestation_error)
            detail == "offline" -> getString(R.string.live_offline)
            detail == "live-not-configured" -> getString(R.string.live_not_configured)
            Regex("429|quota|resource.exhausted", RegexOption.IGNORE_CASE).containsMatchIn(detail) ->
                getString(R.string.live_quota)
            else -> getString(R.string.live_connect_failed)
        }
    }

    private fun refresh() {
        val connected = session != null
        setup.visibility = if (connected) View.GONE else View.VISIBLE
        val configured = coach.liveConfigured()
        if (!connected && status.text.isBlank()) {
            status.text = if (coach.liveConfigured()) getString(R.string.live_ready)
                else getString(R.string.live_not_configured)
        }
        consent.visibility = if (configured) View.VISIBLE else View.GONE
        joinButton.visibility = consent.visibility
        joinButton.isEnabled = configured && consent.isChecked && connection == null
        joinButton.alpha = if (joinButton.isEnabled) 1f else .55f
        cameraButton.isEnabled = connected && !paused && !interrupted && connection == null
        muteButton.isEnabled = cameraButton.isEnabled
        pauseButton.isEnabled = connected && connection == null
        cameraButton.text = if (camera == null) getString(R.string.live_camera_share) else getString(R.string.live_camera_turn_off)
        muteButton.text = if (mic) getString(R.string.live_mute) else getString(R.string.live_unmute)
        pauseButton.text = if (paused || interrupted) getString(R.string.live_resume) else getString(R.string.live_pause)
    }

    private fun endSession() {
        session?.stopReceiving()
        receiver?.cancel()
        receiver = null
        stopCamera()
        stopAudio()
        val previous = session
        session = null
        if (previous != null) closeScope.launch {
            withContext(NonCancellable) { withTimeoutOrNull(3000) { runCatching { previous.close() } } }
        }
        paused = false
        interrupted = false
        inputObserved = false
        outputObserved = false
        modelAudioObserved = false
        resumptionHandle = null
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
            status.text = getString(R.string.live_ended_background)
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

    private fun getStringArrayItem(array: Int, index: Int) = resources.getStringArray(array)[index]

    companion object {
        private const val MIC_PERMISSION = 21
        private const val CAMERA_PERMISSION = 22
    }
}
