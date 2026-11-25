package com.amongus.irl.shell

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Bundle
import android.view.View
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
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        launcherContainer = findViewById(R.id.launcherContainer)
        webContainer = findViewById(R.id.webContainer)
        editHostUrl = findViewById(R.id.editHostUrl)
        launcherErrorText = findViewById(R.id.launcherErrorText)
        txtConnectedHost = findViewById(R.id.txtConnectedHost)
        webView = findViewById(R.id.missionWebView)

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val savedUrl = prefs.getString(KEY_LAST_HOST_URL, "") ?: ""
        if (savedUrl.isNotEmpty()) {
            editHostUrl.setText(savedUrl)
        }

        configureWebView()

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

    override fun onDestroy() {
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
                        showLauncherError(
                            "Could not reach Host PC (${error?.description ?: "Network error"}). Check Wi-Fi and Host address."
                        )
                    }
                }
            }
        }
    }

    private fun connectToHostUrl(rawInput: String) {
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

        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_HOST_URL, trimmed)
            .apply()

        txtConnectedHost.text = activeOrigin
        launcherContainer.visibility = View.GONE
        webContainer.visibility = View.VISIBLE
        webView.loadUrl(trimmed)
    }

    private fun showLauncher() {
        scannerOpen = false
        sendCloseScannerBroadcast()
        webView.stopLoading()
        webContainer.visibility = View.GONE
        launcherContainer.visibility = View.VISIBLE
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

        @JavascriptInterface
        fun closeNativeQrScanner() {
            runOnUiThread {
                scannerOpen = false
                sendCloseScannerBroadcast()
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
    }

    companion object {
        private const val PREFS_NAME = "among_us_irl_shell"
        private const val KEY_LAST_HOST_URL = "last_host_url"
    }
}
