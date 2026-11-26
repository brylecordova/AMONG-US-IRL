package com.amongus.irl.shell

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.Build
import android.os.SystemClock
import android.util.Base64
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import java.io.ByteArrayOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.min

object SecurityCamFrameBus {
    @Volatile
    private var listener: ((String) -> Unit)? = null

    fun setListener(cb: ((String) -> Unit)?) {
        listener = cb
    }

    fun dispatch(base64Jpeg: String) {
        listener?.invoke(base64Jpeg)
    }
}

class SecurityCamService : LifecycleService() {

    private var cameraExecutor: ExecutorService? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private var cameraBound: Boolean = false

    @Volatile
    private var lastFrameAtMs: Long = 0L

    override fun onCreate() {
        super.onCreate()
        activeInstance = this
        isRunning = true
        cameraExecutor = Executors.newSingleThreadExecutor()
        ensureNotificationChannels()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        val action = intent?.action ?: ACTION_START_STANDBY

        when (action) {
            ACTION_STOP -> {
                captureRequested = false
                pausedForScanner = false
                unbindCamera()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START_STANDBY -> {
                promoteToForeground(buildNotification(captureActive = captureRequested))
                if (captureRequested && !pausedForScanner) {
                    bindCameraIfPermitted()
                }
            }
            ACTION_SET_CAPTURE -> {
                val active = intent?.getBooleanExtra(EXTRA_ACTIVE, false) ?: false
                captureRequested = active
                promoteToForeground(buildNotification(captureActive = active))
                if (active && !pausedForScanner) {
                    bindCameraIfPermitted()
                } else {
                    unbindCamera()
                }
            }
            ACTION_RESUME_AFTER_SCANNER -> {
                pausedForScanner = false
                promoteToForeground(buildNotification(captureActive = captureRequested))
                if (captureRequested) {
                    bindCameraIfPermitted()
                }
            }
        }

        return START_NOT_STICKY
    }

    override fun onDestroy() {
        if (!pausedForScanner) {
            unbindCamera()
        }
        cameraExecutor?.shutdownNow()
        cameraExecutor = null
        isRunning = false
        if (activeInstance === this) {
            activeInstance = null
        }
        super.onDestroy()
    }

    private fun promoteToForeground(notification: Notification) {
        try {
            val fgType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
            } else {
                0
            }
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, fgType)
        } catch (_: SecurityException) {
            // Camera permission revoked or OS rejected foreground promotion
        } catch (_: IllegalStateException) {
            // App entered background before foreground start completed
        }
    }

    private fun updateNotification(captureActive: Boolean) {
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        mgr.notify(NOTIFICATION_ID, buildNotification(captureActive))
    }

    private fun bindCameraIfPermitted() {
        if (!captureRequested || pausedForScanner || cameraBound) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            if (!captureRequested || pausedForScanner || !isRunning) return@addListener
            try {
                val provider = providerFuture.get()
                cameraProvider = provider

                val resolutionSelector = ResolutionSelector.Builder()
                    .setResolutionStrategy(
                        ResolutionStrategy(
                            Size(320, 240),
                            ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER
                        )
                    )
                    .build()

                val analysis = ImageAnalysis.Builder()
                    .setResolutionSelector(resolutionSelector)
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()

                val executor = cameraExecutor ?: return@addListener
                analysis.setAnalyzer(executor) { imageProxy ->
                    analyzeFrame(imageProxy)
                }

                provider.unbindAll()
                provider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    analysis
                )
                cameraBound = true
                updateNotification(captureActive = true)
            } catch (_: Exception) {
                cameraBound = false
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun unbindCamera() {
        cameraBound = false
        val provider = cameraProvider ?: return
        ContextCompat.getMainExecutor(this).execute {
            try {
                if (!pausedForScanner || !captureRequested) {
                    provider.unbindAll()
                }
            } catch (_: Exception) {
                // Ignore unbind errors on teardown
            }
        }
    }

    private fun analyzeFrame(imageProxy: ImageProxy) {
        try {
            if (!captureRequested || pausedForScanner) return

            val now = SystemClock.elapsedRealtime()
            if (now - lastFrameAtMs < FRAME_INTERVAL_MS) return
            lastFrameAtMs = now

            val rawBitmap = imageProxy.toBitmap()
            val rotation = imageProxy.imageInfo.rotationDegrees

            val maxEdge = max(rawBitmap.width, rawBitmap.height).coerceAtLeast(1)
            val scale = min(1f, MAX_EDGE_PX.toFloat() / maxEdge.toFloat())

            val outputBitmap = if (scale < 0.99f || rotation != 0) {
                val matrix = Matrix().apply {
                    if (scale < 0.99f) {
                        postScale(scale, scale)
                    }
                    if (rotation != 0) {
                        postRotate(rotation.toFloat())
                    }
                }
                Bitmap.createBitmap(
                    rawBitmap,
                    0,
                    0,
                    rawBitmap.width,
                    rawBitmap.height,
                    matrix,
                    true
                )
            } else {
                rawBitmap
            }

            if (outputBitmap !== rawBitmap) {
                rawBitmap.recycle()
            }

            val baos = ByteArrayOutputStream(12 * 1024)
            outputBitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, baos)
            outputBitmap.recycle()

            val encoded = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
            if (encoded.isNotEmpty()) {
                SecurityCamFrameBus.dispatch(encoded)
            }
        } catch (_: Exception) {
            // Drop single malformed frame cleanly
        } finally {
            imageProxy.close()
        }
    }

    private fun ensureNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = getSystemService(NotificationManager::class.java) ?: return

        val standbyChannel = NotificationChannel(
            CHANNEL_STANDBY,
            "Mission Security Standby",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Keeps mission security camera link ready while playing"
            setSound(null, null)
            enableVibration(false)
            setShowBadge(false)
        }

        val liveChannel = NotificationChannel(
            CHANNEL_LIVE,
            "Security Cam Active",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Indicates when another player is viewing your Security Cam feed"
            setSound(null, null)
            enableVibration(false)
        }

        mgr.createNotificationChannel(standbyChannel)
        mgr.createNotificationChannel(liveChannel)
    }

    private fun buildNotification(captureActive: Boolean): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = if (captureActive) CHANNEL_LIVE else CHANNEL_STANDBY
        val title = if (captureActive) {
            "SECURITY CAM ACTIVE"
        } else {
            "Mission Active • Security Standby"
        }
        val text = if (captureActive) {
            "Another player is viewing your rear camera feed (5 FPS)"
        } else {
            "Rear camera offline until selected on Security terminal"
        }

        return NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setSilent(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    companion object {
        private const val CHANNEL_STANDBY = "skeld_security_standby"
        private const val CHANNEL_LIVE = "skeld_security_live"
        private const val NOTIFICATION_ID = 4201
        private const val FRAME_INTERVAL_MS = 190L
        private const val MAX_EDGE_PX = 320
        private const val JPEG_QUALITY = 52

        const val ACTION_START_STANDBY = "com.amongus.irl.shell.SECURITY_START_STANDBY"
        const val ACTION_SET_CAPTURE = "com.amongus.irl.shell.SECURITY_SET_CAPTURE"
        const val ACTION_RESUME_AFTER_SCANNER = "com.amongus.irl.shell.SECURITY_RESUME_SCANNER"
        const val ACTION_STOP = "com.amongus.irl.shell.SECURITY_STOP"
        const val EXTRA_ACTIVE = "active"

        @Volatile
        var isRunning: Boolean = false
            private set

        @Volatile
        var captureRequested: Boolean = false
            private set

        @Volatile
        var pausedForScanner: Boolean = false
            private set

        @Volatile
        private var activeInstance: SecurityCamService? = null

        fun startStandby(context: Context) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                return
            }
            val intent = Intent(context, SecurityCamService::class.java).apply {
                action = ACTION_START_STANDBY
            }
            try {
                ContextCompat.startForegroundService(context, intent)
            } catch (_: Exception) {
                // Ignore if OS disallows foreground service start from current state
            }
        }

        fun setCaptureActive(context: Context, active: Boolean) {
            captureRequested = active
            if (!active && !isRunning) return
            if (active && ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                return
            }
            val intent = Intent(context, SecurityCamService::class.java).apply {
                action = ACTION_SET_CAPTURE
                putExtra(EXTRA_ACTIVE, active)
            }
            try {
                if (isRunning) {
                    context.startService(intent)
                } else if (active) {
                    ContextCompat.startForegroundService(context, intent)
                }
            } catch (_: Exception) {
                // Ignore service start restriction
            }
        }

        fun pauseForScanner(context: Context, onReady: () -> Unit) {
            pausedForScanner = true
            activeInstance?.cameraBound = false
            val providerFuture = ProcessCameraProvider.getInstance(context)
            providerFuture.addListener({
                try {
                    providerFuture.get().unbindAll()
                } catch (_: Exception) {
                    // Continue launching QR scanner
                }
                onReady()
            }, ContextCompat.getMainExecutor(context))
        }

        fun resumeAfterScanner(context: Context) {
            pausedForScanner = false
            if (!isRunning || !captureRequested) return
            val intent = Intent(context, SecurityCamService::class.java).apply {
                action = ACTION_RESUME_AFTER_SCANNER
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {
                // Ignore
            }
        }

        fun stopAll(context: Context) {
            captureRequested = false
            pausedForScanner = false
            if (!isRunning) return
            val intent = Intent(context, SecurityCamService::class.java).apply {
                action = ACTION_STOP
            }
            try {
                context.startService(intent)
            } catch (_: Exception) {
                context.stopService(Intent(context, SecurityCamService::class.java))
            }
        }
    }
}
