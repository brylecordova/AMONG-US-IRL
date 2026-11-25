package com.amongus.irl.shell

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class QrScannerActivity : AppCompatActivity() {

    private lateinit var previewView: PreviewView
    private lateinit var txtScannerTitle: TextView
    private lateinit var txtScannerStatus: TextView
    private lateinit var btnToggleTorch: Button

    private lateinit var cameraExecutor: ExecutorService
    private val mainHandler = Handler(Looper.getMainLooper())

    private var mode: String = MODE_GAME_SCAN
    private var camera: Camera? = null
    private var torchEnabled: Boolean = false

    @Volatile
    private var awaitingValidation: Boolean = false
    private var unlockRunnable: Runnable? = null

    private val scanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
    )

    private val requestCameraPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            startCamera()
        } else {
            showStatusError("Camera permission denied. Allow camera access in Android Settings to scan QR codes.")
        }
    }

    private val controlReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                ACTION_CLOSE_SCANNER -> finish()
                ACTION_SCAN_VALIDATION -> {
                    val valid = intent.getBooleanExtra(EXTRA_VALID, false)
                    val errMsg = intent.getStringExtra(EXTRA_ERROR).orEmpty()
                    unlockRunnable?.let { mainHandler.removeCallbacks(it) }

                    if (valid) {
                        txtScannerStatus.setTextColor(Color.parseColor("#34D399"))
                        txtScannerStatus.text = "QR verified!"
                        finish()
                    } else {
                        showStatusError(
                            errMsg.ifBlank { "Invalid QR code right now. Keep aiming at the right QR." }
                        )
                        val cooldown = Runnable {
                            awaitingValidation = false
                            resetStatusPrompt()
                        }
                        unlockRunnable = cooldown
                        mainHandler.postDelayed(cooldown, 1200L)
                    }
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_qr_scanner)

        previewView = findViewById(R.id.cameraPreview)
        txtScannerTitle = findViewById(R.id.txtScannerTitle)
        txtScannerStatus = findViewById(R.id.txtScannerStatus)
        btnToggleTorch = findViewById(R.id.btnToggleTorch)

        mode = intent.getStringExtra(EXTRA_MODE) ?: MODE_GAME_SCAN
        txtScannerTitle.text = intent.getStringExtra(EXTRA_TITLE) ?: "Scan QR Code"
        resetStatusPrompt()

        cameraExecutor = Executors.newSingleThreadExecutor()

        findViewById<Button>(R.id.btnCloseScanner).setOnClickListener {
            finish()
        }

        btnToggleTorch.setOnClickListener {
            val cam = camera ?: return@setOnClickListener
            if (cam.cameraInfo.hasFlashUnit()) {
                torchEnabled = !torchEnabled
                cam.cameraControl.enableTorch(torchEnabled)
                btnToggleTorch.text = if (torchEnabled) "Light On" else getString(R.string.scanner_torch)
            }
        }

        val filter = IntentFilter().apply {
            addAction(ACTION_SCAN_VALIDATION)
            addAction(ACTION_CLOSE_SCANNER)
        }
        ContextCompat.registerReceiver(
            this,
            controlReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                finish()
            }
        })

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            startCamera()
        } else {
            requestCameraPermission.launch(Manifest.permission.CAMERA)
        }
    }

    override fun onDestroy() {
        unlockRunnable?.let { mainHandler.removeCallbacks(it) }
        unregisterReceiver(controlReceiver)
        cameraExecutor.shutdown()
        scanner.close()
        sendBroadcast(Intent(ACTION_SCANNER_FINISHED).setPackage(packageName))
        super.onDestroy()
    }

    private fun startCamera() {
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            val cameraProvider = providerFuture.get()
            val preview = Preview.Builder().build().also {
                it.surfaceProvider = previewView.surfaceProvider
            }

            val analysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor) { imageProxy ->
                        processImageProxy(imageProxy)
                    }
                }

            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    analysis
                )
            } catch (_: Exception) {
                showStatusError("Unable to open rear camera. Close other camera apps and reopen.")
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @OptIn(ExperimentalGetImage::class)
    private fun processImageProxy(imageProxy: ImageProxy) {
        if (awaitingValidation) {
            imageProxy.close()
            return
        }

        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        val inputImage = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        scanner.process(inputImage)
            .addOnSuccessListener { barcodes ->
                if (awaitingValidation) return@addOnSuccessListener
                val raw = barcodes.firstNotNullOfOrNull { it.rawValue }?.trim()
                if (!raw.isNullOrEmpty()) {
                    handleScannedRaw(raw)
                }
            }
            .addOnCompleteListener {
                imageProxy.close()
            }
    }

    private fun handleScannedRaw(raw: String) {
        awaitingValidation = true

        mainHandler.post {
            if (mode == MODE_JOIN_HOST) {
                val parsed = runCatching { Uri.parse(raw) }.getOrNull()
                val scheme = parsed?.scheme?.lowercase()
                if (parsed != null && (scheme == "http" || scheme == "https") && !parsed.host.isNullOrBlank()) {
                    val result = Intent().apply {
                        putExtra(EXTRA_SCANNED_RAW, raw)
                    }
                    setResult(RESULT_OK, result)
                    finish()
                } else {
                    showStatusError("Not a Join Mission QR URL. Scan the Host PC Join QR code.")
                    val cooldown = Runnable {
                        awaitingValidation = false
                        resetStatusPrompt()
                    }
                    unlockRunnable = cooldown
                    mainHandler.postDelayed(cooldown, 1200L)
                }
                return@post
            }

            txtScannerStatus.setTextColor(Color.parseColor("#67E8F9"))
            txtScannerStatus.text = "Validating QR code..."

            val detectIntent = Intent(ACTION_QR_DETECTED).apply {
                setPackage(packageName)
                putExtra(EXTRA_SCANNED_RAW, raw)
            }
            sendBroadcast(detectIntent)

            // Safety unlock if validation callback doesn't return within 4 seconds
            val safetyTimeout = Runnable {
                awaitingValidation = false
                resetStatusPrompt()
            }
            unlockRunnable = safetyTimeout
            mainHandler.postDelayed(safetyTimeout, 4000L)
        }
    }

    private fun resetStatusPrompt() {
        txtScannerStatus.setTextColor(Color.parseColor("#F8FAFC"))
        txtScannerStatus.text = if (mode == MODE_JOIN_HOST) {
            "Aim at the Join Mission QR code displayed on the Host PC."
        } else {
            "Aim camera at an AMONG-US IRL QR code. Stays open until valid or closed."
        }
    }

    private fun showStatusError(msg: String) {
        txtScannerStatus.setTextColor(Color.parseColor("#FCA5A5"))
        txtScannerStatus.text = msg
    }

    companion object {
        const val EXTRA_MODE = "mode"
        const val EXTRA_TITLE = "title"
        const val EXTRA_SCANNED_RAW = "scanned_raw"
        const val EXTRA_VALID = "valid"
        const val EXTRA_ERROR = "error"

        const val MODE_JOIN_HOST = "JOIN_HOST"
        const val MODE_GAME_SCAN = "GAME_SCAN"

        const val ACTION_QR_DETECTED = "com.amongus.irl.shell.ACTION_QR_DETECTED"
        const val ACTION_SCAN_VALIDATION = "com.amongus.irl.shell.ACTION_SCAN_VALIDATION"
        const val ACTION_CLOSE_SCANNER = "com.amongus.irl.shell.ACTION_CLOSE_SCANNER"
        const val ACTION_SCANNER_FINISHED = "com.amongus.irl.shell.ACTION_SCANNER_FINISHED"
    }
}
