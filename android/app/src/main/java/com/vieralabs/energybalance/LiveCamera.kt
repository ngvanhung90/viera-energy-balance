package com.vieralabs.energybalance

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.os.Handler
import android.os.Looper
import android.view.Surface
import android.view.TextureView
import kotlin.math.abs

/** Owns only the local preview. The activity chooses when to sample and transmit it. */
internal class LiveCamera(
    private val context: Context,
    private val preview: TextureView,
    private val front: Boolean,
    private val onReady: () -> Unit,
    private val onError: () -> Unit
) : TextureView.SurfaceTextureListener {
    private val handler = Handler(Looper.getMainLooper())
    private var device: CameraDevice? = null
    private var capture: CameraCaptureSession? = null
    private var surface: Surface? = null
    private var closed = false

    fun start() {
        preview.surfaceTextureListener = this
        preview.surfaceTexture?.takeIf { preview.isAvailable }?.let(::open)
    }

    @SuppressLint("MissingPermission")
    private fun open(texture: SurfaceTexture) {
        if (closed || surface != null) return
        if (context.checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            onError()
            return
        }
        try {
            val manager = context.getSystemService(CameraManager::class.java)
            val lens = if (front) CameraCharacteristics.LENS_FACING_FRONT else CameraCharacteristics.LENS_FACING_BACK
            val id = manager.cameraIdList.firstOrNull {
                manager.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == lens
            } ?: manager.cameraIdList.first()
            val map = manager.getCameraCharacteristics(id).get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            val size = map?.getOutputSizes(SurfaceTexture::class.java)?.minByOrNull {
                abs(it.width - 640) + abs(it.height - 480)
            }
            if (size != null) texture.setDefaultBufferSize(size.width, size.height)
            val target = Surface(texture)
            surface = target
            manager.openCamera(id, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    if (closed) {
                        camera.close()
                        return
                    }
                    device = camera
                    preview(camera, target)
                }

                override fun onDisconnected(camera: CameraDevice) = failed(camera)
                override fun onError(camera: CameraDevice, error: Int) = failed(camera)
            }, handler)
        } catch (_: Exception) {
            failed()
        }
    }

    @Suppress("DEPRECATION")
    private fun preview(camera: CameraDevice, target: Surface) {
        try {
            camera.createCaptureSession(listOf(target), object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    if (closed) {
                        session.close()
                        return
                    }
                    capture = session
                    try {
                        val request = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                            addTarget(target)
                            set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_VIDEO)
                        }.build()
                        session.setRepeatingRequest(request, null, handler)
                        onReady()
                    } catch (_: Exception) {
                        failed(camera)
                    }
                }

                override fun onConfigureFailed(session: CameraCaptureSession) {
                    session.close()
                    failed(camera)
                }
            }, handler)
        } catch (_: Exception) {
            failed(camera)
        }
    }

    private fun failed(camera: CameraDevice? = null) {
        if (camera !== device) camera?.close()
        if (!closed) {
            close()
            onError()
        }
    }

    fun close() {
        closed = true
        if (preview.surfaceTextureListener === this) preview.surfaceTextureListener = null
        capture?.close()
        device?.close()
        surface?.release()
        capture = null
        device = null
        surface = null
    }

    override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) = open(surface)
    override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) = Unit
    override fun onSurfaceTextureUpdated(surface: SurfaceTexture) = Unit
    override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
        failed()
        return true
    }
}
