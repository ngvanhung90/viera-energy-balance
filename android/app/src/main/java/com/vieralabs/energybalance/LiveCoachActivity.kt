package com.vieralabs.energybalance

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.graphics.drawable.RippleDrawable
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
import com.google.firebase.ai.type.LiveServerSetupComplete
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
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull

@OptIn(PublicPreviewAPI::class)
internal class LiveCoachActivity : Activity() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val closeScope = CoroutineScope(Dispatchers.Main.immediate)
    private val surface = Color.rgb(241, 242, 238)
    private val ink = Color.rgb(34, 43, 37)
    private val mutedInk = Color.rgb(71, 84, 75)
    private val panel = Color.rgb(232, 237, 228)
    private val outline = Color.rgb(116, 128, 119)
    private val rose = Color.rgb(159, 61, 99)
    private val rosePale = Color.rgb(247, 233, 238)
    private val roseLine = Color.rgb(176, 122, 144)
    private val selectedTone = Color.rgb(239, 213, 223)
    private val selectedInk = Color.rgb(113, 48, 71)
    private val disabledFill = Color.rgb(227, 228, 222)
    private val disabledInk = Color.rgb(82, 86, 80)
    private val dark = Color.rgb(23, 29, 25)
    private val endRed = Color.rgb(144, 49, 73)
    private lateinit var coach: NativeCoach
    private lateinit var content: LinearLayout
    private lateinit var status: TextView
    private lateinit var caption: TextView
    private lateinit var preview: TextureView
    private lateinit var placeholder: TextView
    private lateinit var cameraButton: Button
    private lateinit var questionButton: Button
    private lateinit var joinButton: Button
    private lateinit var pauseButton: Button
    private lateinit var consent: CheckBox
    private lateinit var manualMode: CheckBox
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
    private var sessionLimit: Job? = null
    private var replyLimit: Job? = null
    private var automaticDrain: Job? = null
    private var stepUpdate: Job? = null
    private var stepProvided = 0
    private var audio: LiveVoiceAudio? = null
    private val audioManager by lazy { getSystemService(AudioManager::class.java) }
    private var ownsCommunicationMode = false
    private var audioGeneration = 0
    private var resumptionHandle: String? = null
    private var resumedOnce = false
    private var manualTurns = false
    private var waitForSpeech = false
    private var mic = false
    private var paused = false
    private var interrupted = false
    private var foreground = false
    private var replyPending = false
    private val videoSend = Mutex()
    private var inputObserved = false
    private var outputObserved = false
    private var modelAudioObserved = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        volumeControlStream = AudioManager.STREAM_MUSIC
        coach = NativeCoach(this)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.statusBarColor = surface
        window.navigationBarColor = surface
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or
            (if (Build.VERSION.SDK_INT >= 26) View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR else 0)
        if (Build.VERSION.SDK_INT < 26) window.navigationBarColor = ink
        val scroll = ScrollView(this).apply { setBackgroundColor(surface); isFillViewport = true }
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
        addText(content, "Viera Energy Balance", 19).apply {
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
        }
        addText(content, if (fitness) getString(R.string.live_fitness) else getString(R.string.live_cooking), 26, 5).apply {
            typeface = Typeface.create("sans-serif", Typeface.BOLD)
        }
        subjectLabel = addText(content, "", 14, 4).apply {
            setTextColor(mutedInk)
        }
        val frame = FrameLayout(this).apply {
            background = rounded(dark, 9)
            clipToOutline = true
        }
        preview = TextureView(this)
        frame.addView(preview, FrameLayout.LayoutParams(-1, -1))
        placeholder = TextView(this).apply {
            text = getString(R.string.live_camera_off)
            textSize = 18f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            setPadding(dp(16), dp(34), dp(16), dp(16))
        }
        frame.addView(placeholder, FrameLayout.LayoutParams(-1, -1))
        val service = TextView(this).apply {
            text = "Gemini Live"
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            setPadding(dp(10), dp(5), dp(10), dp(5))
            background = rounded(dark, 10)
        }
        frame.addView(service, FrameLayout.LayoutParams(-2, -2, Gravity.TOP or Gravity.START).apply {
            topMargin = dp(10)
            marginStart = dp(10)
        })
        content.addView(frame, LinearLayout.LayoutParams(-1, dp((resources.configuration.screenWidthDp * .68f).toInt().coerceIn(200, 320))).apply { topMargin = dp(16) })
        status = addText(content, "", 15, 9).apply {
            typeface = Typeface.DEFAULT_BOLD
            background = rounded(panel, 7)
            setPadding(dp(9), dp(7), dp(9), dp(7))
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        caption = addText(content, "", 16, 6).apply { visibility = View.GONE }
        val media = row()
        val fourAcross = resources.configuration.screenWidthDp >= 380 && resources.configuration.fontScale <= 1.1f
        cameraButton = action(media, getString(R.string.live_camera_share), icon = android.R.drawable.ic_menu_camera) { cameraToggle() }
        questionButton = action(media, getString(R.string.live_mic_on), icon = android.R.drawable.ic_btn_speak_now) {
            if (manualTurns) questionTapped() else microphoneToggle()
        }
        val controls = if (fourAcross) media else row()
        pauseButton = action(controls, getString(R.string.live_pause), icon = android.R.drawable.ic_media_pause) { pauseToggle() }
        action(controls, getString(R.string.live_end), endRed, Color.WHITE, android.R.drawable.ic_menu_close_clear_cancel) { finish() }

        val cue = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = rounded(panel, 7)
            setPadding(dp(12), dp(10), dp(12), dp(12))
        }
        content.addView(cue, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(14) })
        stepLabel = addText(cue, "", 16, 4).apply {
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        val progressButtons = row(cue)
        previousStep = action(progressButtons, getString(R.string.live_previous_step)) { moveStep(-1) }
        nextStep = action(progressButtons, getString(R.string.live_next_step), rose, Color.WHITE) { moveStep(1) }

        setup = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(setup)
        if (fitness) buildFitnessForm()
        manualMode = CheckBox(this).apply {
            text = getString(R.string.live_manual_mode)
            setTextColor(ink)
            buttonTintList = checkTint()
        }
        setup.addView(manualMode)
        consent = CheckBox(this).apply {
            text = getString(R.string.live_consent)
            textSize = 14f
            setTextColor(ink)
            buttonTintList = checkTint()
            setPadding(0, dp(10), 0, dp(10))
            setOnCheckedChangeListener { _, _ -> refresh() }
        }
        setup.addView(consent)
        joinButton = Button(this).apply {
            text = getString(R.string.live_start)
            isAllCaps = false
            minHeight = dp(48)
            background = controlBackground(rose)
            setTextColor(controlInk(Color.WHITE))
            setOnClickListener { requestToJoin() }
        }
        setup.addView(joinButton, LinearLayout.LayoutParams(-1, -2))
        addText(content, getString(R.string.live_privacy), 12, 10)
        addText(content, getString(R.string.live_model, NativeCoach.LIVE_MODEL), 12, 8)
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
            minHeight = dp(48)
            background = controlBackground(rosePale)
            setTextColor(controlInk(selectedInk))
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
            val choices = object : ArrayAdapter<String>(
                this@LiveCoachActivity, android.R.layout.simple_spinner_item, values
            ) {
                override fun getView(position: Int, convertView: View?, parent: android.view.ViewGroup): View =
                    (super.getView(position, convertView, parent) as TextView).apply {
                        setTextColor(ink)
                        setSingleLine(false)
                        minHeight = dp(48)
                    }

                override fun getDropDownView(position: Int, convertView: View?, parent: android.view.ViewGroup): View =
                    (super.getDropDownView(position, convertView, parent) as TextView).apply {
                        setTextColor(ink)
                        setSingleLine(false)
                        minHeight = dp(48)
                    }
            }
            choices.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            adapter = choices
            setPopupBackgroundDrawable(rounded(Color.WHITE, 9))
            backgroundTintList = ColorStateList.valueOf(mutedInk)
            val default = when (key) {
                "activity" -> when (intent.getStringExtra("context")) {
                    "walk" -> 0
                    "yoga" -> 1
                    "stretch" -> 2
                    "cardio" -> 3
                    "strength" -> 4
                    "cycle" -> 5
                    "jog" -> 6
                    else -> null
                }
                "duration" -> 1
                else -> 0
            }
            val saved = preferences.getInt(key, default ?: 0)
            setSelection((if (key == "activity") default ?: saved else saved).coerceIn(values.indices))
        }
        addText(setup, label, 13, 8).labelFor = input.id
        setup.addView(input, LinearLayout.LayoutParams(-1, -2))
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
        val connected = session ?: return
        if (!manualTurns && canStream()) queueAutomaticCue(connected, opening = false)
    }

    private fun instruction(): String {
        val uiLanguage = resources.configuration.locales[0].toLanguageTag()
        val common = "You are Viera's voice coach in a synthetic demo. Treat app step updates as the user's confirmed progress. " +
            "Speak in the app language ($uiLanguage), " +
            "and switch to the user's spoken language if they ask. Start at saved step ${step + 1}: ${steps()[step]}. " +
            "Answer each question with one concrete instruction in the first sentence. " +
            "If you did not understand it, ask for one clarification. A greeting or acknowledgement alone is incomplete. " +
            "Describe only details visible in frames from this turn. If no frames arrive or a view is unclear, ask what the user sees. " +
            "Don't infer identity or health from appearance. " +
            "Do not ask for personal, demographic or medical information."
        if (!fitness) {
            val recipe = intent.getStringExtra("context").orEmpty().take(2400)
            return "$common Coach the user through this recipe as they cook: $recipe. " +
                "Use the most recent current-step update or the user's description of what they have already done. " +
                "Start with what to do next, then give one useful cue for when to move on, such as texture, timing, or a measured quantity. " +
                "Use amounts and timing from the recipe when available. If a key detail is missing, ask one focused question. " +
                "When asked for a substitution, give one option and explain how it changes the step. " +
                "Stay with the current step until the user is ready to continue. Keep spoken replies brief and practical. " +
                "For allergies, suggest checking labels. Use a thermometer when food safety depends on internal temperature; never judge it by sight."
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
            "Lead with one movement and explain how to start it, how long to do it, and when to rest. " +
            "Stay within the selected duration, equipment and permitted movements. Include a warm-up and a lower-effort alternative. " +
            "Repeat or adapt the movement when asked. Give camera-based observations only when clear and avoid collecting health information. " +
            "Do not give diagnoses, guarantee posture safety or claim exact calorie burn. If discomfort is mentioned, advise pausing."
    }

    private fun requestToJoin() {
        if (!consent.isChecked || !coach.liveEntryAvailable() || connection != null || session != null) return
        if (!allowed(Manifest.permission.RECORD_AUDIO)) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), MIC_PERMISSION)
        } else join()
    }

    @SuppressLint("MissingPermission")
    private fun join() {
        if (!foreground || !consent.isChecked || !allowed(Manifest.permission.RECORD_AUDIO)) return
        if (fitness) saveFitness()
        manualTurns = manualMode.isChecked
        connection = scope.launch(start = CoroutineStart.LAZY) {
            status.text = getString(R.string.live_connecting)
            try {
                stepProvided = step
                if (!manualTurns) {
                    if (audioManager.mode != AudioManager.MODE_NORMAL) {
                        status.text = getString(R.string.live_audio_output_failed)
                        return@launch
                    }
                    // Match the output use case to VOICE_COMMUNICATION capture, so the
                    // platform can use call playback as the echo-canceller reference.
                    audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                    ownsCommunicationMode = true
                    volumeControlStream = AudioManager.STREAM_VOICE_CALL
                    qaEvent("communication-audio-mode-requested")
                }
                qaEvent("model-setup-start")
                val model = coach.liveModel(instruction(), manualTurns)
                qaEvent("attestation-ready")
                val connected = withTimeout(15000) { model.connect(SessionResumptionConfig()) }
                session = connected
                // Firebase AI Logic's connect() returns after consuming setupComplete.
                qaEvent("sdk-setup-complete")
                startPlayback(connected)
                startReceiving(connected)
                if (session !== connected || interrupted) return@launch
                sessionLimit = scope.launch {
                    delay(5 * 60_000L)
                    sessionLimit = null
                    endSession()
                    consent.isChecked = false
                    status.text = getString(R.string.live_session_limit)
                    refresh()
                }
                if (manualTurns) {
                    status.text = getString(R.string.live_connected)
                } else {
                    startMicrophone()
                    updateAutomaticStatus()
                    queueAutomaticCue(connected, opening = true)
                }
            } catch (error: TimeoutCancellationException) {
                qaEvent("sdk-connect-timeout")
                endSession()
                status.text = getString(R.string.live_connect_timeout)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                qaFailure("sdk-connect-failed", error)
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

    private fun startPlayback(connected: LiveSession) {
        if (audio != null) return
        val generation = ++audioGeneration
        audio = LiveVoiceAudio(
            scope,
            communicationPlayback = !manualTurns,
            send = { bytes -> withTimeout(5000) { connected.sendAudioRealtime(InlineData(bytes, LiveVoiceAudio.INPUT_MIME)) } },
            event = ::qaEvent,
            failed = { reason -> scope.launch {
                if (session === connected && generation == audioGeneration) {
                    qaEvent(reason)
                    when {
                        reason.startsWith("speaker") -> {
                            connection?.cancel()
                            endSession()
                            status.text = getString(R.string.live_audio_output_failed)
                            refresh()
                        }
                        mic && reason.startsWith("mic-send") -> interruptCall()
                        mic -> interruptCall()
                    }
                }
            } }
        ).also { it.startPlayback() }
    }

    private suspend fun startMicrophone() {
        val voice = checkNotNull(audio)
        voice.awaitMicrophoneStopped()
        if (audio !== voice || !canStream()) return
        if (!foreground || !allowed(Manifest.permission.RECORD_AUDIO)) return
        voice.startMicrophone()
        mic = true
    }

    private fun stopMicrophone() {
        mic = false
        audio?.stopMicrophone()
    }

    private fun microphoneToggle() {
        val connected = session ?: return
        if (!canStream() || connection != null) return
        if (mic) {
            stopMicrophone()
            updateAutomaticStatus()
            refresh()
            return
        }
        if (!allowed(Manifest.permission.RECORD_AUDIO)) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), MIC_PERMISSION)
            return
        }
        connection = scope.launch(start = CoroutineStart.LAZY) {
            try {
                startMicrophone()
                if (canStream()) {
                    updateAutomaticStatus()
                    if (step != stepProvided) queueAutomaticCue(connected, opening = false)
                }
            } finally {
                connection = null
                refresh()
            }
        }
        connection?.start()
        refresh()
    }

    private fun updateAutomaticStatus() {
        status.text = getString(if (mic) R.string.live_listening else R.string.live_mic_muted)
    }

    private fun queueAutomaticCue(connected: LiveSession, opening: Boolean) {
        stepUpdate?.cancel()
        val current = step
        val cue = if (opening) "Start coaching now. Briefly guide the current step and wait for my reply."
            else "I selected step ${current + 1}: ${steps()[current]}. Guide me through this step."
        stepUpdate = scope.launch {
            try {
                withTimeout(5000) {
                    videoSend.withLock {
                        if (session !== connected || !canStream()) return@withLock
                        waitForSpeech = false
                        if (!opening) {
                            audio?.discardPlayback()
                            automaticDrain?.cancel()
                        }
                        clearTurn()
                        connected.sendTextRealtime(cue)
                        stepProvided = current
                        qaEvent(if (opening) "automatic-opening-cue" else "automatic-step-cue")
                    }
                }
            } catch (error: TimeoutCancellationException) {
                qaFailure("automatic-cue-timeout", error)
                interruptCall()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                qaFailure("automatic-cue-failed", error)
                interruptCall()
            }
        }
    }

    private fun clearTurn() {
        caption.text = ""
        caption.visibility = View.GONE
        inputObserved = false
        outputObserved = false
        modelAudioObserved = false
    }

    private fun startReceiving(connected: LiveSession) {
        receiver = scope.launch {
            try {
                // The SDK polls its WebSocket. Keep that work off the UI and audio paths.
                connected.receive().flowOn(Dispatchers.IO).collect { message ->
                    if (session !== connected) return@collect
                    when (message) {
                        is LiveServerSetupComplete -> qaEvent("server-setup-complete")
                        is LiveSessionResumptionUpdate -> {
                            if (message.resumable == true && !message.newHandle.isNullOrBlank()) {
                                if (resumptionHandle == null) qaEvent("resume-handle-received")
                                resumptionHandle = message.newHandle
                            }
                        }
                        is LiveServerVoiceActivity -> if (canStream()) {
                            when (message.type) {
                                VoiceActivityType.ACTIVITY_START -> {
                                    qaEvent("server-speech-start")
                                    if (!manualTurns) {
                                        waitForSpeech = false
                                        // Also clear audible output if the previous server turn
                                        // finished while its tail was still playing on the phone.
                                        audio?.discardPlayback()
                                        automaticDrain?.cancel()
                                        clearTurn()
                                        updateAutomaticStatus()
                                    }
                                }
                                VoiceActivityType.ACTIVITY_END -> qaEvent("server-speech-end")
                                else -> Unit
                            }
                        }
                        is LiveServerGoAway -> interruptCall()
                        is LiveServerContent -> if (!interrupted && !paused) renderServerContent(message)
                        else -> Unit
                    }
                }
                qaEvent("server-receive-closed")
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                qaFailure("server-receive-error", error)
            } finally {
                if (isActive && session === connected) interruptCall()
            }
        }
    }

    private suspend fun renderServerContent(message: LiveServerContent) {
        if (manualTurns && !mic && !replyPending) return
        if (message.interrupted) {
            audio?.discardPlayback()
            if (manualTurns) {
                if (replyPending) interruptCall()
            } else {
                automaticDrain?.cancel()
                clearTurn()
                updateAutomaticStatus()
                qaEvent("automatic-reply-interrupted")
            }
            return
        }
        if (!manualTurns && waitForSpeech) {
            if (message.inputTranscription?.text.isNullOrBlank()) return
            waitForSpeech = false
        }
        if (!inputObserved && !message.inputTranscription?.text.isNullOrBlank()) {
            inputObserved = true
            qaEvent("input-transcribed")
        }
        message.outputTranscription?.let { output ->
            caption.text = (caption.text.toString() + output.text.orEmpty()).take(400)
            caption.visibility = if (caption.text.isBlank()) View.GONE else View.VISIBLE
            if (!outputObserved && caption.text.isNotBlank()) {
                outputObserved = true
                qaEvent("output-transcribed")
            }
        }
        if (manualTurns && !replyPending) return
        for (part in message.content?.parts.orEmpty().filterIsInstance<InlineDataPart>()) {
            if (paused || interrupted) return
            if (!part.mimeType.startsWith("audio/pcm", ignoreCase = true)) continue
            if (!modelAudioObserved && part.inlineData.isNotEmpty()) {
                modelAudioObserved = true
                qaEvent("model-pcm-received")
            }
            if (manualTurns) {
                audio?.play(part.inlineData)
            } else if (audio?.enqueueLiveAudio(part.inlineData) != true) {
                qaEvent("speaker-buffer-full")
                interruptCall()
                return
            }
        }
        if (message.turnComplete) {
            qaEvent("server-turn-complete")
            if (!manualTurns) {
                val voice = audio
                if (modelAudioObserved && voice != null) {
                    automaticDrain?.cancel()
                    automaticDrain = scope.launch {
                        val drained = voice.awaitPlaybackDrained()
                        if (canStream() && audio === voice) {
                            qaEvent(if (drained) "automatic-reply-audio-drained" else "automatic-reply-audio-incomplete")
                        }
                    }
                }
                modelAudioObserved = false
                return
            }
            replyLimit?.cancel()
            replyLimit = null
            val played = modelAudioObserved && audio?.awaitPlaybackDrained() == true
            if (!replyPending) return
            if (!played) audio?.discardPlayback()
            replyPending = false
            qaEvent(if (played) "reply-audio-drained" else "reply-audio-incomplete")
            status.text = getString(if (played) R.string.live_connected else R.string.live_incomplete_reply)
            refresh()
        }
    }

    private fun interruptCall() {
        if (interrupted || session == null) return
        interrupted = true
        paused = false
        pauseStreams()
        status.text = getString(R.string.live_interrupted)
        refresh()
    }

    private fun questionTapped() {
        val connected = session ?: return
        if (!canStream() || connection != null || replyPending) return
        if (!allowed(Manifest.permission.RECORD_AUDIO)) {
            status.text = getString(R.string.live_mic_needed)
            return
        }
        val finishing = mic
        connection = scope.launch(start = CoroutineStart.LAZY) {
            try {
                if (finishing) {
                    replyPending = true
                    stopMicrophone()
                    audio?.awaitMicrophoneStopped()
                    if (session !== connected || !canStream()) return@launch
                    status.text = getString(R.string.live_awaiting_reply)
                    replyLimit = scope.launch {
                        delay(25000)
                        if (replyPending && session === connected) {
                            qaEvent("reply-timeout")
                            replyLimit = null
                            endSession()
                            consent.isChecked = false
                            status.text = getString(R.string.live_incomplete_reply)
                            refresh()
                        }
                    }
                    withTimeout(5000) { videoSend.withLock { connected.sendStopActivityRealtime() } }
                    qaEvent("question-sent")
                } else {
                    clearTurn()
                    withTimeout(5000) {
                        connected.sendStartActivityRealtime()
                        val current = step
                        if (current != stepProvided) {
                            connected.sendTextRealtime("Current step ${current + 1}: ${steps()[current]}.")
                            stepProvided = current
                        }
                    }
                    startMicrophone()
                    if (!mic) {
                        interruptCall()
                        return@launch
                    }
                    qaEvent("question-started")
                    status.text = getString(R.string.live_recording_question)
                }
            } catch (error: TimeoutCancellationException) {
                qaEvent("question-timeout")
                interruptCall()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                qaFailure("question-error", error)
                interruptCall()
            } finally {
                connection = null
                refresh()
            }
        }
        connection?.start()
        refresh()
    }

    private fun pauseToggle() {
        val connected = session ?: return
        if (connection != null || (manualTurns && (mic || replyPending))) return
        if (interrupted || paused) {
            resumeCall(connected)
        } else {
            paused = true
            pauseStreams()
            status.text = getString(R.string.live_paused)
            refresh()
        }
    }

    private fun pauseStreams() {
        replyPending = false
        waitForSpeech = !manualTurns
        stepUpdate?.cancel()
        automaticDrain?.cancel()
        replyLimit?.cancel()
        replyLimit = null
        stopCamera()
        stopMicrophone()
        audio?.discardPlayback()
        clearTurn()
    }

    private fun resumeCall(connected: LiveSession) {
        connection = scope.launch(start = CoroutineStart.LAZY) {
            try {
                audio?.awaitMicrophoneStopped()
                if (session !== connected) return@launch
                val reconnect = interrupted
                if (reconnect) {
                    status.text = getString(R.string.live_reconnecting)
                    val handle = resumptionHandle
                    if (resumedOnce || handle == null) {
                        endSession()
                        consent.isChecked = false
                        status.text = getString(R.string.live_resume_failed)
                        return@launch
                    }
                    resumedOnce = true
                    connected.stopReceiving()
                    receiver?.cancelAndJoin()
                    withTimeout(12000) { connected.resumeSession(SessionResumptionConfig(handle)) }
                    qaEvent("resume-with-handle-connected")
                }
                paused = false
                interrupted = false
                if (reconnect) startReceiving(connected)
                if (session === connected && !interrupted) {
                    if (manualTurns) status.text = getString(R.string.live_camera_remains_off)
                    else updateAutomaticStatus()
                }
            } catch (error: TimeoutCancellationException) {
                endSession()
                consent.isChecked = false
                status.text = getString(R.string.live_resume_timeout)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                qaFailure("sdk-resume-failed", error)
                endSession()
                consent.isChecked = false
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
        if (ownsCommunicationMode) {
            ownsCommunicationMode = false
            audioManager.mode = AudioManager.MODE_NORMAL
            volumeControlStream = AudioManager.STREAM_MUSIC
        }
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
                        if (manualTurns && !mic) continue
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
                            videoSend.withLock {
                                if ((!manualTurns || mic) && canStream() && camera != null && session === connected && jpeg.isNotEmpty()) {
                                    withTimeout(5000) { connected.sendVideoRealtime(InlineData(jpeg, "image/jpeg")) }
                                    if (!firstFrameSent) {
                                        firstFrameSent = true
                                        qaEvent("camera-frame-sent")
                                    }
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
        if (coach.liveQaDiagnostics() || applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            Log.i("VieraLiveQA", "${if (fitness) "fitness" else "cooking"}: $event")
        }
    }

    private fun qaFailure(stage: String, error: Exception) {
        val code = generateSequence<Throwable>(error) { it.cause }.take(4).firstNotNullOfOrNull { cause ->
            Regex("\\b(?:100[0-9]|101[0-5]|400|401|403|429|500|503)\\b").find(cause.message.orEmpty())?.value
        }
        // Do not record exception text, which can contain request or user content.
        qaEvent("$stage ${error.javaClass.simpleName}${code?.let { " code=$it" }.orEmpty()}")
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, results)
        if (results.firstOrNull() != PackageManager.PERMISSION_GRANTED) {
            status.text = if (requestCode == MIC_PERMISSION) getString(R.string.live_mic_denied) else getString(R.string.live_camera_denied)
            return
        }
        when (requestCode) {
            MIC_PERMISSION -> if (session == null) join() else microphoneToggle()
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
        val configured = coach.liveEntryAvailable()
        if (!connected && status.text.isBlank()) {
            status.text = if (configured) getString(R.string.live_ready)
                else getString(R.string.live_not_configured)
        }
        consent.visibility = if (configured) View.VISIBLE else View.GONE
        joinButton.visibility = consent.visibility
        manualMode.visibility = consent.visibility
        manualMode.isEnabled = connection == null
        joinButton.isEnabled = configured && consent.isChecked && connection == null
        cameraButton.isEnabled = connected && !paused && !interrupted && connection == null
        questionButton.isEnabled = cameraButton.isEnabled && (!manualTurns || !replyPending)
        pauseButton.isEnabled = connected && connection == null && (!manualTurns || (!mic && !replyPending))
        cameraButton.text = if (camera == null) getString(R.string.live_camera_share) else getString(R.string.live_camera_turn_off)
        questionButton.text = getString(when {
            manualTurns && mic -> R.string.live_send_question
            manualTurns -> R.string.live_ask_question
            mic -> R.string.live_mic_off
            else -> R.string.live_mic_on
        })
        pauseButton.text = if (paused || interrupted) getString(R.string.live_resume) else getString(R.string.live_pause)
        cameraButton.isSelected = camera != null
        questionButton.isSelected = mic
        pauseButton.isSelected = paused || interrupted
    }

    private fun endSession() {
        sessionLimit?.cancel()
        sessionLimit = null
        replyPending = false
        waitForSpeech = false
        stepUpdate?.cancel()
        stepUpdate = null
        automaticDrain?.cancel()
        automaticDrain = null
        replyLimit?.cancel()
        replyLimit = null
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
        resumedOnce = false
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

    private fun row(parent: LinearLayout = content) = LinearLayout(this).also {
        it.gravity = Gravity.TOP
        parent.addView(it, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(7) })
    }

    private fun action(
        row: LinearLayout, label: String, backgroundColor: Int = rosePale,
        foregroundColor: Int = selectedInk, icon: Int = 0, click: () -> Unit
    ): Button =
        Button(this).apply {
            text = label
            isAllCaps = false
            minHeight = dp(if (icon == 0) 48 else 62)
            minimumWidth = 0
            textSize = if (icon == 0) 14f else 12f
            setPadding(dp(4), dp(8), dp(4), dp(8))
            background = controlBackground(backgroundColor)
            val colors = controlInk(foregroundColor)
            setTextColor(colors)
            if (icon != 0) {
                setCompoundDrawablesWithIntrinsicBounds(0, icon, 0, 0)
                compoundDrawableTintList = colors
                compoundDrawablePadding = dp(3)
            }
            setOnClickListener { click() }
            row.addView(this, LinearLayout.LayoutParams(0, -2, 1f).apply {
                if (row.childCount > 0) marginStart = dp(7)
            })
        }

    private fun controlInk(defaultColor: Int) = ColorStateList(
        arrayOf(intArrayOf(-android.R.attr.state_enabled), intArrayOf(android.R.attr.state_selected), intArrayOf()),
        intArrayOf(disabledInk, selectedInk, defaultColor)
    )

    private fun checkTint() = ColorStateList(
        arrayOf(intArrayOf(-android.R.attr.state_enabled), intArrayOf(android.R.attr.state_checked), intArrayOf()),
        intArrayOf(disabledInk, rose, mutedInk)
    )

    private fun controlBackground(color: Int): RippleDrawable {
        val fill = StateListDrawable().apply {
            addState(intArrayOf(-android.R.attr.state_enabled), rounded(disabledFill, 7, outline))
            addState(intArrayOf(android.R.attr.state_selected), rounded(selectedTone, 7, roseLine))
            addState(intArrayOf(), rounded(color, 7, if (color == rosePale) roseLine else null))
        }
        return RippleDrawable(ColorStateList.valueOf(0x26000000), fill, null)
    }

    private fun addText(parent: LinearLayout, label: String, size: Int, margin: Int = 0) =
        TextView(this).apply {
            text = label
            textSize = size.toFloat()
            setTextColor(ink)
            parent.addView(this, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(margin) })
        }

    private fun rounded(color: Int, radius: Int, border: Int? = null) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radius).toFloat()
        if (border != null) setStroke(dp(1), border)
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density + .5f).toInt()

    private fun getStringArrayItem(array: Int, index: Int) = resources.getStringArray(array)[index]

    companion object {
        private const val MIC_PERMISSION = 21
        private const val CAMERA_PERMISSION = 22
    }
}
