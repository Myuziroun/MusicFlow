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
    // Batas aman di bawah Binder transaction limit (~1 MB). Cover yang lebih
    // besar dilewati agar startForegroundService tidak gagal.
    private static final int MAX_COVER_SOURCE_CHARS = 512 * 1024;
    private static WeakReference<PlaybackServicePlugin> instanceRef = new WeakReference<>(null);

    // Sumber cover terakhir disimpan agar service yang baru dimulai tetap
    // mendapatkan cover meskipun panggilan setCoverSource datang lebih dulu.
    private static String pendingCoverKey = "";
    private static String pendingCoverUrl = "";
    private static String pendingCoverFilePath = "";
    private static String pendingCoverData = "";
    private static String lastUpdateCoverKey = "";

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

        String coverKey = data.optString("coverKey", "");
        intent.putExtra(PlaybackService.EXTRA_COVER_KEY, coverKey);

        boolean trackChanged = !coverKey.equals(lastUpdateCoverKey);
        lastUpdateCoverKey = coverKey;

        // Jika service belum berjalan atau track baru saja berganti, sertakan
        // sumber cover yang sudah di-cache. Ini menutup race condition ketika
        // setCoverSource tiba sebelum service selesai dibuat.
        if ((trackChanged || !PlaybackService.isRunning)
            && !pendingCoverKey.isEmpty()
            && pendingCoverKey.equals(coverKey)) {
            putCoverSource(
                intent,
                pendingCoverKey,
                pendingCoverUrl,
                pendingCoverFilePath,
                pendingCoverData
            );
        }

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
     * Menyimpan sumber cover dan meneruskannya ke service. Jika service belum
     * selesai dibuat, sumber disimpan sebagai deferred source dan diterapkan
     * saat updateState untuk track yang sama tiba.
     */
    @PluginMethod
    public void setCoverSource(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Konteks Android tidak tersedia");
            return;
        }

        String key = call.getString("key", "");
        if (key == null || key.isEmpty()) {
            call.reject("coverKey wajib diisi");
            return;
        }

        String coverUrl = sanitizeCoverSource(call.getString("coverUrl", ""));
        String filePath = valueOrEmpty(call.getString("filePath", ""));
        String coverData = sanitizeCoverSource(call.getString("coverData", ""));

        pendingCoverKey = key;
        pendingCoverUrl = coverUrl;
        pendingCoverFilePath = filePath;
        pendingCoverData = coverData;

        Intent intent = new Intent(context, PlaybackService.class);
        intent.setAction(PlaybackService.ACTION_SET_COVER_SOURCE);
        putCoverSource(intent, key, coverUrl, filePath, coverData);

        try {
            // Tetap kirim meskipun service belum selesai dibuat. Service akan
            // menyimpan sumber ini sebagai deferred source sampai updateState
            // untuk track yang sama tiba.
            context.startService(intent);
            call.resolve();
        } catch (Exception e) {
            // Sumber tetap tersimpan di pending fields dan akan disertakan
            // pada updateState berikutnya.
            Log.w(TAG, "Gagal mengirim sumber cover ke playback service", e);
            call.resolve();
        }
    }

    private static void putCoverSource(
        Intent intent,
        String key,
        String coverUrl,
        String filePath,
        String coverData
    ) {
        intent.putExtra(PlaybackService.EXTRA_COVER_KEY, valueOrEmpty(key));
        intent.putExtra(PlaybackService.EXTRA_COVER_URL, sanitizeCoverSource(coverUrl));
        intent.putExtra(PlaybackService.EXTRA_FILE_PATH, valueOrEmpty(filePath));
        intent.putExtra(PlaybackService.EXTRA_COVER_DATA, sanitizeCoverSource(coverData));
    }

    private static String sanitizeCoverSource(String value) {
        if (value == null || value.length() > MAX_COVER_SOURCE_CHARS) {
            return "";
        }
        return value;
    }

    private static String valueOrEmpty(String value) {
        return value != null ? value : "";
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

        // Activity dihancurkan bersama service, jadi sumber cover yang
        // di-cache tidak lagi diperlukan.
        pendingCoverKey = "";
        pendingCoverUrl = "";
        pendingCoverFilePath = "";
        pendingCoverData = "";
        lastUpdateCoverKey = "";

        super.handleOnDestroy();
    }
}
