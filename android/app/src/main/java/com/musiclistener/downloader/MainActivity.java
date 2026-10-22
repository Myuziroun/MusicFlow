package com.musiclistener.downloader;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShareServerPlugin.class);
        super.onCreate(savedInstanceState);

        // Izinkan Mixed Content untuk transfer HTTP P2P di jaringan lokal
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
        } catch (Exception e) {
            // Abaikan jika webview belum siap
        }
    }
}
