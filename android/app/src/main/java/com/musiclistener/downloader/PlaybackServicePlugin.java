package com.musiclistener.downloader;

import android.content.Context;
import android.content.Intent;
import android.util.Log;
import android.webkit.WebView;

import androidx.core.content.ContextCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.lang.ref.WeakReference;

/**
 * Jembatan antara WebView dan PlaybackService native.
 *
 * Arah JS -> native: updateState() mengirim metadata, status putar, dan posisi
 * agar MediaSession serta notifikasi Android selalu sinkron dengan elemen audio
 * yang berjalan di WebView.
 *
 * Arah native -> JS: perintah dari notifikasi/layar kunci dikirim melalui
 * window.__musicflowNativeCommand yang didaftarkan oleh PlayerContext.
 */
@CapacitorPlugin(name = "PlaybackService")
public class PlaybackServicePlugin extends Plugin {

    private static final String TAG = "PlaybackServicePlugin";
    private static WeakReference<PlaybackServicePlugin> instanceRef = new WeakReference<>(null);

    @Override
    public void load() {
        instanceRef = new WeakReference<>(this);
    }

    /**
     * Memperbarui state pemutaran dan memastikan foreground service berjalan.
     * Dipanggil dari JS saat track berubah, play, pause, atau seek.
     */
    @PluginMethod
    public void updateState(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Konteks Android tidak tersedia");
            return;
        }

        JSObject data = call.getData();
        Intent intent = new Intent(context, PlaybackService.class);
        intent.setAction(PlaybackService.ACTION_UPDATE);
        intent.putExtra(PlaybackService.EXTRA_TITLE, data.optString("title", ""));
        intent.putExtra(PlaybackService.EXTRA_ARTIST, data.optString("artist", ""));
        intent.putExtra(PlaybackService.EXTRA_ALBUM, data.optString("album", ""));
        intent.putExtra(PlaybackService.EXTRA_DURATION, data.optDouble("duration", 0));
        intent.putExtra(PlaybackService.EXTRA_POSITION, data.optDouble("position", 0));
        intent.putExtra(PlaybackService.EXTRA_IS_PLAYING, data.optBoolean("isPlaying", false));

        try {
            if (PlaybackService.isRunning) {
                // Service sudah foreground; startService aman dipanggil dari background.
                context.startService(intent);
            } else {
                // Panggilan pertama berasal dari aksi pengguna (menekan play).
                ContextCompat.startForegroundService(context, intent);
            }
            call.resolve();
        } catch (Exception e) {
            Log.w(TAG, "Gagal memulai foreground service pemutaran", e);
            call.reject("Gagal memulai playback service", e);
        }
    }

    /**
     * Mengirim perintah MediaSession native ke handler JavaScript di WebView.
     */
    static void emitCommand(String action, Double positionSeconds) {
        PlaybackServicePlugin plugin = instanceRef.get();
        if (plugin == null) return;

        Bridge bridge = plugin.getBridge();
        if (bridge == null) return;

        WebView webView = bridge.getWebView();
        if (webView == null) return;

        try {
            JSONObject payload = new JSONObject();
            payload.put("action", action);
            if (positionSeconds != null) {
                payload.put("position", positionSeconds);
            }

            String script = "window.__musicflowNativeCommand && window.__musicflowNativeCommand("
                + payload.toString() + ");";
            webView.post(() -> {
                try {
                    webView.evaluateJavascript(script, null);
                } catch (Exception e) {
                    Log.w(TAG, "Gagal mengeksekusi perintah di WebView", e);
                }
            });
        } catch (Exception e) {
            Log.w(TAG, "Gagal mengirim perintah ke WebView", e);
        }
    }

    @Override
    protected void handleOnDestroy() {
        PlaybackServicePlugin current = instanceRef.get();
        if (current == this) {
            instanceRef = new WeakReference<>(null);
        }
        super.handleOnDestroy();
    }
}
