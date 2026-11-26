package com.amongus.irl.shell

import android.Manifest
import android.annotation.SuppressLint
import android.app.Dialog
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var launcherContainer: View
    private lateinit var webContainer: View
    private lateinit var editHostUrl: EditText
    private lateinit var launcherErrorText: TextView
    private lateinit var txtConnectedHost: TextView
    private lateinit var webView: WebView

    private var activeOrigin: String? = null
    private var scannerOpen: Boolean = false
    private var matchActive: Boolean = false
    private var cameraPermissionRequestedForMatch: Boolean = false

    private val requestSecurityPermissions = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val cameraGranted = results[Manifest.permission.CAMERA] == true ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        if (cameraGranted && matchActive) {
            SecurityCamService.startStandby(this)
            if (SecurityCamService.captureRequested && !scannerOpen) {
                SecurityCamService.setCaptureActive(this, true)
            }
        }
    }

    private val joinQrLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val scannedUrl = result.data?.getStringExtra(QrScannerActivity.EXTRA_SCANNED_RAW)?.trim()
            if (!scannedUrl.isNullOrEmpty()) {
                editHostUrl.setText(scannedUrl)
                connectToHostUrl(scannedUrl)
            }
        }
    }

    private val qrDetectedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != QrScannerActivity.ACTION_QR_DETECTED) return
            val raw = intent.getStringExtra(QrScannerActivity.EXTRA_SCANNED_RAW) ?: return
            val quoted = JSONObject.quote(raw)
            webView.post {
                val originNow = extractOrigin(webView.url)
                if (activeOrigin != null && originNow == activeOrigin) {
                    webView.evaluateJavascript(
                        "if (window.__onAndroidQrScanned) { window.__onAndroidQrScanned($quoted); }",
                        null
                    )
                } else {
                    sendValidationBroadcast(false, "Mission page changed before QR validation.")
                }
            }
        }
    }

    private val scannerClosedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == QrScannerActivity.ACTION_SCANNER_FINISHED) {
                scannerOpen = false
                notifyJsScannerBusy(false)
                SecurityCamService.resumeAfterScanner(this@MainActivity)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureSystemBars()
        setContentView(R.layout.activity_main)

        launcherContainer = findViewById(R.id.launcherContainer)
        webContainer = findViewById(R.id.webContainer)
        val webToolbar = findViewById<View>(R.id.webToolbar)
        editHostUrl = findViewById(R.id.editHostUrl)
        launcherErrorText = findViewById(R.id.launcherErrorText)
        txtConnectedHost = findViewById(R.id.txtConnectedHost)
        webView = findViewById(R.id.missionWebView)

        applySafeSystemBarInsets(webToolbar)

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val savedUrl = prefs.getString(KEY_LAST_HOST_URL, "") ?: ""
        val savedSessionCode = prefs.getString(KEY_SAVED_SESSION_CODE, "") ?: ""
        val savedRejoinCode = prefs.getString(KEY_SAVED_REJOIN_CODE, "") ?: ""
        if (savedUrl.isNotEmpty()) {
            editHostUrl.setText(savedUrl)
        }

        configureWebView()

        if (savedUrl.isNotBlank() && savedSessionCode.isNotBlank() && savedRejoinCode.isNotBlank()) {
            val cleanOriginUrl = extractOrigin(savedUrl) ?: savedUrl
            connectToHostUrl(cleanOriginUrl, persistLastUrl = false)
        }

        findViewById<Button>(R.id.btnScanHostQr).setOnClickListener {
            hideLauncherError()
            val intent = Intent(this, QrScannerActivity::class.java).apply {
                putExtra(QrScannerActivity.EXTRA_MODE, QrScannerActivity.MODE_JOIN_HOST)
                putExtra(QrScannerActivity.EXTRA_TITLE, "Scan Host Join QR Code")
            }
            joinQrLauncher.launch(intent)
        }

        findViewById<Button>(R.id.btnConnectUrl).setOnClickListener {
            connectToHostUrl(editHostUrl.text?.toString().orEmpty())
        }

        findViewById<Button>(R.id.btnReloadWeb).setOnClickListener {
            webView.reload()
        }

        findViewById<Button>(R.id.btnSwitchHost).setOnClickListener {
            showLauncher()
        }

        findViewById<Button>(R.id.btnLeaveLobby).setOnClickListener {
            confirmAndLeaveLobby()
        }

        ContextCompat.registerReceiver(
            this,
            qrDetectedReceiver,
            IntentFilter(QrScannerActivity.ACTION_QR_DETECTED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        ContextCompat.registerReceiver(
            this,
            scannerClosedReceiver,
            IntentFilter(QrScannerActivity.ACTION_SCANNER_FINISHED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )

        SecurityCamFrameBus.setListener { base64Jpeg ->
            val quoted = JSONObject.quote(base64Jpeg)
            webView.post {
                val originNow = extractOrigin(webView.url)
                if (activeOrigin != null && originNow == activeOrigin) {
                    webView.evaluateJavascript(
                        "if (window.__onAndroidSecurityFrame) { window.__onAndroidSecurityFrame($quoted); }",
                        null
                    )
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webContainer.visibility == View.VISIBLE) {
                    if (webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        showLauncher()
                    }
                } else {
                    finish()
                }
            }
        })
    }

    private fun configureSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
    }

    private fun applySafeSystemBarInsets(webToolbar: View) {
        val toolbarLeft = webToolbar.paddingLeft
        val toolbarTop = webToolbar.paddingTop
        val toolbarRight = webToolbar.paddingRight
        val toolbarBottom = webToolbar.paddingBottom

        val launcherLeft = launcherContainer.paddingLeft
        val launcherTop = launcherContainer.paddingTop
        val launcherRight = launcherContainer.paddingRight
        val launcherBottom = launcherContainer.paddingBottom

        val rootView = findViewById<View>(android.R.id.content)
        ViewCompat.setOnApplyWindowInsetsListener(rootView) { _, insets ->
            val safeBars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            val bottomInset = maxOf(safeBars.bottom, ime.bottom)

            webToolbar.setPadding(
                toolbarLeft,
                toolbarTop + safeBars.top,
                toolbarRight,
                toolbarBottom
            )

            webContainer.setPadding(
                safeBars.left,
                0,
                safeBars.right,
                bottomInset
            )

            launcherContainer.setPadding(
                launcherLeft + safeBars.left,
                launcherTop + safeBars.top,
                launcherRight + safeBars.right,
                launcherBottom + bottomInset
            )

            WindowInsetsCompat.CONSUMED
        }
        ViewCompat.requestApplyInsets(rootView)
    }

    override fun onDestroy() {
        SecurityCamFrameBus.setListener(null)
        SecurityCamService.stopAll(this)
        unregisterReceiver(qrDetectedReceiver)
        unregisterReceiver(scannerClosedReceiver)
        webView.removeJavascriptInterface("AmongUsAndroid")
        webView.destroy()
        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        webView.addJavascriptInterface(SkeldAndroidBridge(), "AmongUsAndroid")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return
                val reqOrigin = extractOrigin(request.origin?.toString())
                if (activeOrigin != null && reqOrigin == activeOrigin) {
                    runOnUiThread {
                        request.grant(request.resources)
                    }
                } else {
                    request.deny()
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val targetUri = request?.url ?: return true
                val scheme = targetUri.scheme?.lowercase()
                if (scheme != "http" && scheme != "https") {
                    // Reject non-HTTP(S) schemes such as javascript:, file:, content:
                    return true
                }
                return false
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    runOnUiThread {
                        showLauncher()
                        showLauncherError(
                            "Could not reach Host PC (${error?.description ?: "Network error"}). Check Wi-Fi and Host address."
                        )
                    }
                }
            }
        }
    }

    private fun connectToHostUrl(rawInput: String, persistLastUrl: Boolean = true) {
        val trimmed = rawInput.trim()
        val parsed = runCatching { Uri.parse(trimmed) }.getOrNull()
        val scheme = parsed?.scheme?.lowercase()
        val host = parsed?.host

        if (parsed == null || (scheme != "http" && scheme != "https") || host.isNullOrBlank()) {
            showLauncherError("Enter a valid Host URL starting with http:// or https://")
            return
        }

        hideLauncherError()
        activeOrigin = extractOrigin(trimmed)

        if (persistLastUrl) {
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putString(KEY_LAST_HOST_URL, trimmed)
                .apply()
        }

        txtConnectedHost.text = activeOrigin
        launcherContainer.visibility = View.GONE
        webContainer.visibility = View.VISIBLE
        ViewCompat.requestApplyInsets(findViewById(android.R.id.content))
        webView.loadUrl(trimmed)
    }

    private fun showLauncher() {
        scannerOpen = false
        matchActive = false
        cameraPermissionRequestedForMatch = false
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        SecurityCamService.stopAll(this)
        sendCloseScannerBroadcast()
        webView.stopLoading()
        webContainer.visibility = View.GONE
        launcherContainer.visibility = View.VISIBLE
        ViewCompat.requestApplyInsets(findViewById(android.R.id.content))
    }

    private fun confirmAndLeaveLobby() {
        val dialog = Dialog(this)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        dialog.setContentView(R.layout.dialog_leave_lobby)
        dialog.window?.apply {
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            val marginPx = (32 * resources.displayMetrics.density).toInt()
            val maxWidth = resources.displayMetrics.widthPixels - marginPx
            setLayout(maxWidth.coerceAtLeast(ViewGroup.LayoutParams.WRAP_CONTENT), ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        dialog.findViewById<View>(R.id.btnAirlockStay)?.setOnClickListener {
            performNativeHaptic("light")
            dialog.dismiss()
        }
        dialog.findViewById<View>(R.id.btnAirlockEject)?.setOnClickListener {
            performNativeHaptic("medium")
            dialog.dismiss()
            leaveCurrentLobby()
        }

        dialog.show()
    }

    private fun leaveCurrentLobby() {
        scannerOpen = false
        matchActive = false
        cameraPermissionRequestedForMatch = false
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        SecurityCamService.stopAll(this)
        sendCloseScannerBroadcast()

        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .remove(KEY_SAVED_SESSION_CODE)
            .remove(KEY_SAVED_REJOIN_CODE)
            .apply()

        val fallbackOrigin = activeOrigin
        val js = """
            (function() {
              try { window.localStorage.removeItem('skeld_irl_saved_player_session'); } catch (e) {}
              if (typeof window.__onAndroidLeaveLobby === 'function') {
                window.__onAndroidLeaveLobby();
                return 'handled';
              }
              return 'reload';
            })();
        """.trimIndent()

        webView.evaluateJavascript(js) { result ->
            if (result != "\"handled\"" && !fallbackOrigin.isNullOrBlank()) {
                webView.loadUrl(fallbackOrigin)
            }
        }
    }

    private fun ensureSecurityPermissionsAndStandby(forcePrompt: Boolean = false) {
        val hasCamera = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        val needsNotification = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED

        if (hasCamera && matchActive) {
            SecurityCamService.startStandby(this)
        }

        if ((!hasCamera || needsNotification) && (!cameraPermissionRequestedForMatch || forcePrompt)) {
            cameraPermissionRequestedForMatch = true
            val toRequest = mutableListOf<String>()
            if (!hasCamera) {
                toRequest.add(Manifest.permission.CAMERA)
            }
            if (needsNotification && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                toRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
            if (toRequest.isNotEmpty()) {
                requestSecurityPermissions.launch(toRequest.toTypedArray())
            }
        }
    }

    private fun notifyJsScannerBusy(busy: Boolean) {
        val flag = if (busy) "true" else "false"
        webView.post {
            val originNow = extractOrigin(webView.url)
            if (activeOrigin != null && originNow == activeOrigin) {
                webView.evaluateJavascript(
                    "if (window.__onAndroidScannerBusyChanged) { window.__onAndroidScannerBusyChanged($flag); }",
                    null
                )
            }
        }
    }

    private fun showLauncherError(message: String) {
        launcherErrorText.text = message
        launcherErrorText.visibility = View.VISIBLE
    }

    private fun hideLauncherError() {
        launcherErrorText.visibility = View.GONE
    }

    private fun extractOrigin(urlString: String?): String? {
        if (urlString.isNullOrBlank()) return null
        val uri = runCatching { Uri.parse(urlString) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase() ?: return null
        val host = uri.host ?: return null
        val port = uri.port
        val portSuffix = if (
            port == -1 ||
            (scheme == "http" && port == 80) ||
            (scheme == "https" && port == 443)
        ) {
            ""
        } else {
            ":$port"
        }
        return "${scheme}://${host}${portSuffix}"
    }

    private fun sendValidationBroadcast(valid: Boolean, errorMessage: String) {
        val intent = Intent(QrScannerActivity.ACTION_SCAN_VALIDATION).apply {
            setPackage(packageName)
            putExtra(QrScannerActivity.EXTRA_VALID, valid)
            putExtra(QrScannerActivity.EXTRA_ERROR, errorMessage)
        }
        sendBroadcast(intent)
    }

    private fun sendCloseScannerBroadcast() {
        val intent = Intent(QrScannerActivity.ACTION_CLOSE_SCANNER).apply {
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }

    inner class SkeldAndroidBridge {
        @JavascriptInterface
        fun openNativeQrScanner(title: String?) {
            runOnUiThread {
                val originNow = extractOrigin(webView.url)
                if (activeOrigin == null || originNow != activeOrigin || scannerOpen) {
                    return@runOnUiThread
                }
                scannerOpen = true
                notifyJsScannerBusy(true)
                SecurityCamService.pauseForScanner(this@MainActivity) {
                    if (!scannerOpen) {
                        notifyJsScannerBusy(false)
                        SecurityCamService.resumeAfterScanner(this@MainActivity)
                        return@pauseForScanner
                    }
                    val intent = Intent(this@MainActivity, QrScannerActivity::class.java).apply {
                        putExtra(QrScannerActivity.EXTRA_MODE, QrScannerActivity.MODE_GAME_SCAN)
                        putExtra(
                            QrScannerActivity.EXTRA_TITLE,
                            title?.takeIf { it.isNotBlank() } ?: "Scan Mission QR"
                        )
                    }
                    startActivity(intent)
                }
            }
        }

        @JavascriptInterface
        fun closeNativeQrScanner() {
            runOnUiThread {
                scannerOpen = false
                sendCloseScannerBroadcast()
                notifyJsScannerBusy(false)
                SecurityCamService.resumeAfterScanner(this@MainActivity)
            }
        }

        @JavascriptInterface
        fun notifyQrValidation(valid: Boolean, errorMessage: String?) {
            runOnUiThread {
                if (valid) {
                    scannerOpen = false
                }
                sendValidationBroadcast(valid, errorMessage.orEmpty())
            }
        }

        @JavascriptInterface
        fun setMatchActive(active: Boolean) {
            runOnUiThread {
                val originNow = extractOrigin(webView.url)
                if (activeOrigin == null || originNow != activeOrigin) {
                    return@runOnUiThread
                }
                matchActive = active
                if (active) {
                    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    ensureSecurityPermissionsAndStandby()
                } else {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    cameraPermissionRequestedForMatch = false
                    SecurityCamService.stopAll(this@MainActivity)
                }
            }
        }

        @JavascriptInterface
        fun setSecurityCaptureActive(active: Boolean) {
            runOnUiThread {
                val originNow = extractOrigin(webView.url)
                if (activeOrigin == null || originNow != activeOrigin) {
                    return@runOnUiThread
                }
                if (active && !matchActive) {
                    matchActive = true
                    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                }
                SecurityCamService.setCaptureActive(this@MainActivity, active)
            }
        }

        @JavascriptInterface
        fun requestCameraPermission() {
            runOnUiThread {
                val originNow = extractOrigin(webView.url)
                if (activeOrigin == null || originNow != activeOrigin) {
                    return@runOnUiThread
                }
                ensureSecurityPermissionsAndStandby(forcePrompt = true)
            }
        }

        @JavascriptInterface
        fun hasCameraPermission(): Boolean {
            return ContextCompat.checkSelfPermission(
                this@MainActivity,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        }

        @JavascriptInterface
        fun triggerHaptic(kind: String?) {
            runOnUiThread {
                val originNow = extractOrigin(webView.url)
                if (activeOrigin == null || originNow != activeOrigin) {
                    return@runOnUiThread
                }
                performNativeHaptic(kind.orEmpty())
            }
        }

        @JavascriptInterface
        fun savePlayerSession(sessionCode: String?, rejoinCode: String?) {
            val cleanSession = sessionCode?.trim()?.uppercase().orEmpty()
            val cleanRejoin = rejoinCode?.trim()?.uppercase().orEmpty()
            if (cleanSession.isBlank() || cleanRejoin.isBlank()) return
            runOnUiThread {
                val originNow = extractOrigin(webView.url)
                if (activeOrigin == null || originNow != activeOrigin) {
                    return@runOnUiThread
                }
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .edit()
                    .putString(KEY_SAVED_SESSION_CODE, cleanSession)
                    .putString(KEY_SAVED_REJOIN_CODE, cleanRejoin)
                    .apply()
            }
        }

        @JavascriptInterface
        fun clearPlayerSession() {
            runOnUiThread {
                val originNow = extractOrigin(webView.url)
                if (activeOrigin == null || originNow != activeOrigin) {
                    return@runOnUiThread
                }
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .edit()
                    .remove(KEY_SAVED_SESSION_CODE)
                    .remove(KEY_SAVED_REJOIN_CODE)
                    .apply()
            }
        }

        @JavascriptInterface
        fun getSavedPlayerSessionJson(): String {
            val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            val sessionCode = prefs.getString(KEY_SAVED_SESSION_CODE, "")?.trim().orEmpty()
            val rejoinCode = prefs.getString(KEY_SAVED_REJOIN_CODE, "")?.trim().orEmpty()
            if (sessionCode.isBlank() || rejoinCode.isBlank()) return ""
            return JSONObject().apply {
                put("sessionCode", sessionCode)
                put("rejoinCode", rejoinCode)
            }.toString()
        }
    }

    @Suppress("DEPRECATION")
    private fun performNativeHaptic(kind: String) {
        val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
        if (vibrator == null || !vibrator.hasVibrator()) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val predefined = when (kind) {
                "selection", "light" -> VibrationEffect.EFFECT_TICK
                "medium" -> VibrationEffect.EFFECT_CLICK
                "heavy" -> VibrationEffect.EFFECT_HEAVY_CLICK
                else -> null
            }
            if (predefined != null) {
                vibrator.vibrate(VibrationEffect.createPredefined(predefined))
                return
            }
        }

        val pattern: LongArray
        val amplitudes: IntArray
        when (kind) {
            "selection" -> {
                pattern = longArrayOf(0, 10)
                amplitudes = intArrayOf(0, 80)
            }
            "light" -> {
                pattern = longArrayOf(0, 16)
                amplitudes = intArrayOf(0, 110)
            }
            "medium" -> {
                pattern = longArrayOf(0, 28)
                amplitudes = intArrayOf(0, 175)
            }
            "heavy" -> {
                pattern = longArrayOf(0, 45)
                amplitudes = intArrayOf(0, 240)
            }
            "success" -> {
                pattern = longArrayOf(0, 18, 45, 32)
                amplitudes = intArrayOf(0, 140, 0, 220)
            }
            "warning" -> {
                pattern = longArrayOf(0, 35, 55, 35)
                amplitudes = intArrayOf(0, 190, 0, 190)
            }
            "error" -> {
                pattern = longArrayOf(0, 45, 45, 45, 45, 65)
                amplitudes = intArrayOf(0, 220, 0, 220, 0, 255)
            }
            "alarm" -> {
                pattern = longArrayOf(0, 140, 80, 140, 80, 180)
                amplitudes = intArrayOf(0, 230, 0, 230, 0, 255)
            }
            "killed" -> {
                pattern = longArrayOf(0, 220, 90, 320)
                amplitudes = intArrayOf(0, 255, 0, 255)
            }
            "sabotage" -> {
                pattern = longArrayOf(0, 160, 85, 160)
                amplitudes = intArrayOf(0, 220, 0, 240)
            }
            else -> {
                pattern = longArrayOf(0, 20)
                amplitudes = intArrayOf(0, 150)
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (pattern.size == 2) {
                vibrator.vibrate(VibrationEffect.createOneShot(pattern[1], amplitudes[1]))
            } else {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, amplitudes, -1))
            }
        } else {
            vibrator.vibrate(pattern, -1)
        }
    }

    companion object {
        private const val PREFS_NAME = "among_us_irl_shell"
        private const val KEY_LAST_HOST_URL = "last_host_url"
        private const val KEY_SAVED_SESSION_CODE = "saved_session_code"
        private const val KEY_SAVED_REJOIN_CODE = "saved_rejoin_code"
    }
}
