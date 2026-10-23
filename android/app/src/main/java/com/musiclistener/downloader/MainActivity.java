package com.musiclistener.downloader;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShareServerPlugin.class);
        registerPlugin(PlaybackServicePlugin.class);
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

    @Override
    public void onDestroy() {
        // Activity dan WebView pemutar akan hilang, jadi hentikan juga service
        // agar notifikasi tidak tertinggal tanpa kontrol.
        stopService(new Intent(this, PlaybackService.class));
        super.onDestroy();
    }
}
