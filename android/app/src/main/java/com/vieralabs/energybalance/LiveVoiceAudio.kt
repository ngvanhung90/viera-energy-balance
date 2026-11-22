package com.vieralabs.energybalance

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.media.audiofx.AcousticEchoCanceler
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.atomic.AtomicInteger

/** In-memory 16 kHz capture and 24 kHz playback for one consented Live audio exchange. */
internal class LiveVoiceAudio(
    private val scope: CoroutineScope,
    private val send: suspend (ByteArray) -> Unit,
    private val event: (String) -> Unit,
    private val failed: (String) -> Unit
) {
    private val capture = AtomicReference<AudioRecord?>()
    private val playbackRevision = AtomicInteger()
    private val playback = Channel<PlaybackChunk>(24)
    private var microphoneJob: Job? = null
    private var playbackJob: Job? = null

    @SuppressLint("MissingPermission") // The Activity checks RECORD_AUDIO before starting capture.
    fun startMicrophone() {
        if (microphoneJob?.isActive == true) return
        microphoneJob = scope.launch(Dispatchers.IO) {
            try {
                val min = AudioRecord.getMinBufferSize(INPUT_RATE, AudioFormat.CHANNEL_IN_MONO, PCM)
                check(min > 0)
                val record = AudioRecord.Builder()
                    .setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION)
                    .setAudioFormat(format(INPUT_RATE, AudioFormat.CHANNEL_IN_MONO))
                    .setBufferSizeInBytes(maxOf(min, INPUT_CHUNK_BYTES * 2))
                    .build()
                capture.set(record)
                var echo: AcousticEchoCanceler? = null
                try {
                    check(record.state == AudioRecord.STATE_INITIALIZED)
                    if (!isActive) return@launch
                    if (AcousticEchoCanceler.isAvailable()) {
                        echo = runCatching {
                            AcousticEchoCanceler.create(record.audioSessionId)?.apply { enabled = true }
                        }.getOrNull()
                    }
                    record.startRecording()
                    check(record.recordingState == AudioRecord.RECORDSTATE_RECORDING)
                    event("mic-capture-ready")
                    val buffer = ByteArray(INPUT_CHUNK_BYTES)
                    var signalSeen = false
                    var chunkSent = false
                    while (isActive) {
                        val count = record.read(buffer, 0, buffer.size, AudioRecord.READ_BLOCKING)
                        if (!isActive) break
                        check(count > 0 && count % 2 == 0)
                        if (!signalSeen && pcm16HasSignal(buffer, count)) {
                            signalSeen = true
                            event("mic-signal")
                        }
                        try {
                            send(buffer.copyOf(count))
                        } catch (_: TimeoutCancellationException) {
                            if (isActive) failed("mic-send-timeout")
                            break
                        } catch (cancelled: CancellationException) {
                            throw cancelled
                        } catch (_: Exception) {
                            if (isActive) failed("mic-send-error")
                            break
                        }
                        if (!chunkSent) {
                            chunkSent = true
                            event("mic-pcm-sent")
                        }
                    }
                } finally {
                    capture.compareAndSet(record, null)
                    echo?.release()
                    runCatching { record.stop() }
                    record.release()
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                if (isActive) failed("mic-read-error")
            }
        }
    }

    fun startPlayback() {
        playbackJob = scope.launch(Dispatchers.IO) {
            try {
                val min = AudioTrack.getMinBufferSize(OUTPUT_RATE, AudioFormat.CHANNEL_OUT_MONO, PCM)
                check(min > 0)
                val track = AudioTrack.Builder()
                    .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                    .setAudioFormat(format(OUTPUT_RATE, AudioFormat.CHANNEL_OUT_MONO))
                    .setBufferSizeInBytes(min)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build()
                try {
                    check(track.state == AudioTrack.STATE_INITIALIZED)
                    var written = false
                    var appliedRevision = 0
                    for (part in playback) {
                        if (!isActive) break
                        if (part.revision != playbackRevision.get()) continue
                        if (part.revision != appliedRevision) {
                            track.pause()
                            track.flush()
                            appliedRevision = part.revision
                        }
                        val chunk = part.bytes ?: continue
                        if (track.playState != AudioTrack.PLAYSTATE_PLAYING) track.play()
                        var offset = 0
                        while (isActive && part.revision == playbackRevision.get() && offset < chunk.size) {
                            val count = track.write(chunk, offset, chunk.size - offset, AudioTrack.WRITE_NON_BLOCKING)
                            check(count >= 0)
                            offset += count
                            if (count == 0) delay(10)
                        }
                        if (offset > 0 && !written) {
                            written = true
                            event("speaker-pcm-written")
                        }
                    }
                } finally {
                    runCatching { track.pause(); track.flush() }
                    track.release()
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                failed("speaker-write-error")
            }
        }
    }

    suspend fun play(bytes: ByteArray) {
        if (bytes.isEmpty() || bytes.size % 2 != 0) return
        try {
            playback.send(PlaybackChunk(playbackRevision.get(), bytes))
        } catch (_: CancellationException) {
            // Ending the exchange may close this queue while the receiver is waiting for space.
            currentCoroutineContext().ensureActive()
        }
    }

    fun discardPlayback() {
        val revision = playbackRevision.incrementAndGet()
        while (playback.tryReceive().isSuccess) {
            // The playback worker discards any old chunk already in progress.
        }
        playback.trySend(PlaybackChunk(revision, null))
    }

    fun stopMicrophone() {
        microphoneJob?.cancel()
        capture.get()?.let { record -> runCatching { record.stop() } }
    }

    suspend fun awaitMicrophoneStopped() {
        microphoneJob?.join()
        currentCoroutineContext().ensureActive()
    }

    fun stop() {
        stopMicrophone()
        playbackJob?.cancel()
        playback.cancel()
    }

    private data class PlaybackChunk(val revision: Int, val bytes: ByteArray?)

    private fun format(rate: Int, channels: Int): AudioFormat = AudioFormat.Builder()
        .setEncoding(PCM).setSampleRate(rate).setChannelMask(channels).build()

    companion object {
        const val INPUT_MIME = "audio/pcm;rate=16000"
        private const val INPUT_RATE = 16000
        private const val OUTPUT_RATE = 24000
        private const val PCM = AudioFormat.ENCODING_PCM_16BIT
        private const val INPUT_CHUNK_BYTES = 2560

        internal fun pcm16HasSignal(bytes: ByteArray, count: Int): Boolean {
            var offset = 0
            while (offset + 1 < count) {
                val sample = (bytes[offset + 1].toInt() shl 8) or (bytes[offset].toInt() and 0xff)
                if (sample !in -256..256) return true
                offset += 2
            }
            return false
        }
    }
}
