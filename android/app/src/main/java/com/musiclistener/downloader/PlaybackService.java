package com.musiclistener.downloader;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Foreground service yang menampilkan kontrol pemutaran di notifikasi dan
 * layar kunci Android.
 *
 * Audio tetap diputar oleh elemen HTMLAudioElement di WebView. Service ini
 * tidak mendekode audio sendiri; tugasnya menjaga proses tetap hidup,
 * menyediakan MediaSession native, dan menjembatani perintah pengguna ke JS.
 */
public class PlaybackService extends Service {

    private static final String TAG = "PlaybackService";

    public static final String ACTION_UPDATE = "com.musiclistener.downloader.PLAYBACK_UPDATE";
    public static final String ACTION_STOP = "com.musiclistener.downloader.PLAYBACK_STOP";
    public static final String ACTION_TOGGLE = "com.musiclistener.downloader.PLAYBACK_TOGGLE";
    public static final String ACTION_NEXT = "com.musiclistener.downloader.PLAYBACK_NEXT";
    public static final String ACTION_PREVIOUS = "com.musiclistener.downloader.PLAYBACK_PREVIOUS";
    public static final String ACTION_SET_COVER_SOURCE =
        "com.musiclistener.downloader.PLAYBACK_SET_COVER_SOURCE";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_DURATION = "duration";
    public static final String EXTRA_POSITION = "position";
    public static final String EXTRA_IS_PLAYING = "isPlaying";
    public static final String EXTRA_COVER_KEY = "coverKey";
    public static final String EXTRA_COVER_URL = "coverUrl";
    public static final String EXTRA_FILE_PATH = "filePath";
    public static final String EXTRA_COVER_DATA = "coverData";

    private static final String CHANNEL_ID = "musicflow_playback";
    private static final int NOTIFICATION_ID = 2107;
    private static final int MAX_COVER_SIZE_PX = 512;
    private static final int MAX_COVER_BYTES = 2 * 1024 * 1024;
    private static final int MAX_COVER_DATA_CHARS = 3 * 1024 * 1024;

    public static volatile boolean isRunning = false;

    private MediaSessionCompat mediaSession;
    private PowerManager.WakeLock wakeLock;

    private String title = "";
    private String artist = "";
    private String album = "";
    private long durationMs = 0;
    private long positionMs = 0;
    private boolean isPlaying = false;

    private String coverKey = "";
    private Bitmap coverBitmap;
    private ExecutorService coverExecutor;
    private Handler mainHandler;
    private int coverLoadRequestId = 0;

    private String deferredCoverKey = "";
    private String deferredCoverUrl = "";
    private String deferredCoverFilePath = "";
    private String deferredCoverData = "";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        createWakeLock();
        createMediaSession();
        coverExecutor = Executors.newSingleThreadExecutor();
        mainHandler = new Handler(Looper.getMainLooper());
        isRunning = true;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_STOP.equals(action)) {
            // Hentikan audio WebView juga, bukan hanya service-nya, agar tidak
            // ada pemutaran tanpa kontrol setelah notifikasi ditutup.
            PlaybackServicePlugin.emitCommand("pause", null);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_UPDATE.equals(action) && intent != null) {
            applyStateFromIntent(intent);
        }

        if (ACTION_SET_COVER_SOURCE.equals(action) && intent != null) {
            applyCoverSourceFromIntent(intent);
        }

        // Cover-only boleh datang sebelum updateState pertama. Jangan tampilkan
        // notifikasi kosong; updateState berikutnya akan mempromosikan service.
        boolean coverOnlyStart =
            ACTION_SET_COVER_SOURCE.equals(action) && title.isEmpty();
        if (!coverOnlyStart) {
            // Wajib dipanggil cepat setelah startForegroundService, termasuk
            // saat service dihidupkan ulang oleh aksi notifikasi.
            promoteToForeground();
        }

        if (ACTION_TOGGLE.equals(action)) {
            PlaybackServicePlugin.emitCommand("toggle", null);
        } else if (ACTION_NEXT.equals(action)) {
            PlaybackServicePlugin.emitCommand("next", null);
        } else if (ACTION_PREVIOUS.equals(action)) {
            PlaybackServicePlugin.emitCommand("previous", null);
        }

        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Aplikasi dihapus dari recents: WebView ikut hilang, jadi hentikan
        // service agar tidak menyisakan notifikasi yang tidak bisa dikontrol.
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        // Jika service dihentikan sistem saat masih memutar, hentikan juga
        // audio WebView agar tidak ada playback tanpa kontrol.
        if (isPlaying) {
            PlaybackServicePlugin.emitCommand("pause", null);
        }

        isRunning = false;
        isPlaying = false;
        releaseWakeLock();

        coverLoadRequestId++;
        coverKey = "";
        coverBitmap = null;
        clearDeferredCover();

        if (coverExecutor != null) {
            coverExecutor.shutdownNow();
            coverExecutor = null;
        }

        if (mainHandler != null) {
            mainHandler.removeCallbacksAndMessages(null);
            mainHandler = null;
        }

        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }

        ServiceCompat.stopForeground(this, Service.STOP_FOREGROUND_REMOVE);

        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.playback_channel_name),
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.playback_channel_description));
        channel.setShowBadge(false);
        channel.setSound(null, null);

        NotificationManager manager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private void createWakeLock() {
        PowerManager powerManager =
            (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager == null) return;

        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "MusicFlow:Playback"
        );
        wakeLock.setReferenceCounted(false);
    }

    private void createMediaSession() {
        mediaSession = new MediaSessionCompat(this, "MusicFlow");
        mediaSession.setSessionActivity(createContentIntent());
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                PlaybackServicePlugin.emitCommand("play", null);
            }

            @Override
            public void onPause() {
                PlaybackServicePlugin.emitCommand("pause", null);
            }

            @Override
            public void onSkipToNext() {
                PlaybackServicePlugin.emitCommand("next", null);
            }

            @Override
            public void onSkipToPrevious() {
                PlaybackServicePlugin.emitCommand("previous", null);
            }

            @Override
            public void onSeekTo(long pos) {
                PlaybackServicePlugin.emitCommand("seek", pos / 1000.0);
            }

            @Override
            public void onStop() {
                PlaybackServicePlugin.emitCommand("pause", null);
                stopSelf();
            }
        }, new Handler(Looper.getMainLooper()));
        mediaSession.setActive(true);
    }

    private void applyStateFromIntent(Intent intent) {
        title = valueOrEmpty(intent.getStringExtra(EXTRA_TITLE));
        artist = valueOrEmpty(intent.getStringExtra(EXTRA_ARTIST));
        album = valueOrEmpty(intent.getStringExtra(EXTRA_ALBUM));
        durationMs = Math.max(0, Math.round(intent.getDoubleExtra(EXTRA_DURATION, 0) * 1000));
        positionMs = Math.max(0, Math.round(intent.getDoubleExtra(EXTRA_POSITION, 0) * 1000));
        isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, false);

        String newCoverKey = valueOrEmpty(intent.getStringExtra(EXTRA_COVER_KEY));
        boolean coverChanged = !newCoverKey.equals(coverKey);
        if (coverChanged) {
            coverKey = newCoverKey;
            coverBitmap = null;
            coverLoadRequestId++;
        }

        updateWakeLock(isPlaying);
        updateMediaSession();

        if (coverChanged) {
            String coverData = valueOrEmpty(intent.getStringExtra(EXTRA_COVER_DATA));
            String filePath = valueOrEmpty(intent.getStringExtra(EXTRA_FILE_PATH));
            String coverUrl = valueOrEmpty(intent.getStringExtra(EXTRA_COVER_URL));

            // Sumber cover bisa tiba sebelum updateState pertama. Ambil
            // deferred source jika key-nya cocok dengan track yang baru.
            if (coverData.isEmpty()
                && filePath.isEmpty()
                && coverUrl.isEmpty()
                && deferredCoverKey.equals(coverKey)) {
                coverData = deferredCoverData;
                filePath = deferredCoverFilePath;
                coverUrl = deferredCoverUrl;
            }

            if (deferredCoverKey.equals(coverKey)) {
                clearDeferredCover();
            }

            loadCoverAsync(coverKey, coverData, filePath, coverUrl);
        }
    }

    private void applyCoverSourceFromIntent(Intent intent) {
        String key = valueOrEmpty(intent.getStringExtra(EXTRA_COVER_KEY));
        if (key.isEmpty()) return;

        String coverData = valueOrEmpty(intent.getStringExtra(EXTRA_COVER_DATA));
        String filePath = valueOrEmpty(intent.getStringExtra(EXTRA_FILE_PATH));
        String coverUrl = valueOrEmpty(intent.getStringExtra(EXTRA_COVER_URL));

        if (!key.equals(coverKey)) {
            // Track belum diterima service. Simpan sampai updateState dengan
            // key yang sama datang, agar urutan intent tidak menjadi masalah.
            deferredCoverKey = key;
            deferredCoverData = coverData;
            deferredCoverFilePath = filePath;
            deferredCoverUrl = coverUrl;
            return;
        }

        clearDeferredCover();

        if (coverData.isEmpty() && filePath.isEmpty() && coverUrl.isEmpty()) {
            coverBitmap = null;
            coverLoadRequestId++;
            updateMediaSession();
            return;
        }

        loadCoverAsync(key, coverData, filePath, coverUrl);
    }

    private void clearDeferredCover() {
        deferredCoverKey = "";
        deferredCoverData = "";
        deferredCoverFilePath = "";
        deferredCoverUrl = "";
    }

    private void updateMediaSession() {
        if (mediaSession == null) return;

        if (!title.isEmpty()) {
            MediaMetadataCompat.Builder metadataBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs);

            if (coverBitmap != null) {
                // Album art dan art dipasang bersamaan agar kompatibel dengan
                // berbagai versi Android serta kontrol media OEM.
                metadataBuilder.putBitmap(
                    MediaMetadataCompat.METADATA_KEY_ALBUM_ART,
                    coverBitmap
                );
                metadataBuilder.putBitmap(
                    MediaMetadataCompat.METADATA_KEY_ART,
                    coverBitmap
                );
            }

            mediaSession.setMetadata(metadataBuilder.build());
        }

        long actions = PlaybackStateCompat.ACTION_PLAY
            | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_PLAY_PAUSE
            | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            | PlaybackStateCompat.ACTION_SEEK_TO
            | PlaybackStateCompat.ACTION_STOP;

        PlaybackStateCompat playbackState = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(
                isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                positionMs,
                isPlaying ? 1.0f : 0.0f
            )
            .build();
        mediaSession.setPlaybackState(playbackState);
    }

    private void promoteToForeground() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification() {
        PendingIntent contentIntent = createContentIntent();
        PendingIntent previousIntent = createActionIntent(ACTION_PREVIOUS, 1);
        PendingIntent toggleIntent = createActionIntent(ACTION_TOGGLE, 2);
        PendingIntent nextIntent = createActionIntent(ACTION_NEXT, 3);
        PendingIntent deleteIntent = createActionIntent(ACTION_STOP, 4);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_musicflow)
            .setContentTitle(title.isEmpty() ? getString(R.string.playback_notification_title) : title)
            .setContentText(artist)
            .setContentIntent(contentIntent)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setSilent(true)
            .setOngoing(isPlaying)
            .setDeleteIntent(deleteIntent)
            .addAction(
                android.R.drawable.ic_media_previous,
                getString(R.string.playback_previous),
                previousIntent
            )
            .addAction(
                isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                getString(isPlaying ? R.string.playback_pause : R.string.playback_play),
                toggleIntent
            )
            .addAction(
                android.R.drawable.ic_media_next,
                getString(R.string.playback_next),
                nextIntent
            );

        // Tetap set null saat tidak ada cover agar large icon dari track
        // sebelumnya tidak terbawa ke notifikasi track baru.
        builder.setLargeIcon(coverBitmap);

        if (!album.isEmpty()) {
            builder.setSubText(album);
        }

        if (mediaSession != null) {
            MediaStyle style = new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2);
            builder.setStyle(style);
        }

        return builder.build();
    }

    /**
     * Memuat cover di luar main thread agar ekstraksi file atau unduhan HTTP
     * tidak memblokir pembaruan MediaSession dan notifikasi.
     */
    private void loadCoverAsync(
        String key,
        String coverData,
        String filePath,
        String coverUrl
    ) {
        if (coverData.isEmpty() && filePath.isEmpty() && coverUrl.isEmpty()) {
            return;
        }

        ExecutorService executor = coverExecutor;
        Handler handler = mainHandler;
        if (executor == null || executor.isShutdown() || handler == null) {
            return;
        }

        final int requestId = ++coverLoadRequestId;

        try {
            executor.execute(() -> {
                Bitmap bitmap = resolveCoverBitmap(coverData, filePath, coverUrl);
                handler.post(() -> {
                    if (requestId != coverLoadRequestId || !key.equals(coverKey)) {
                        return;
                    }

                    if (bitmap == null) {
                        Log.w(TAG, "Cover tidak dapat dimuat untuk track " + key);
                        return;
                    }

                    coverBitmap = bitmap;
                    updateMediaSession();
                    promoteToForeground();
                });
            });
        } catch (Exception e) {
            Log.w(TAG, "Gagal menjadwalkan pemuatan cover", e);
        }
    }

    /**
     * Urutan sumber cover: data dari WebView, cover tertanam di file audio,
     * lalu URL gambar. File audio diprioritaskan agar cover tetap tersedia
     * saat perangkat offline.
     */
    private Bitmap resolveCoverBitmap(
        String coverData,
        String filePath,
        String coverUrl
    ) {
        if (!coverData.isEmpty()) {
            Bitmap bitmap = decodeCoverData(coverData);
            if (bitmap != null) return bitmap;
        }

        if (!filePath.isEmpty()) {
            Bitmap bitmap = extractEmbeddedCover(filePath);
            if (bitmap != null) return bitmap;
        }

        if (!coverUrl.isEmpty()) {
            if (coverUrl.startsWith("data:")) {
                return decodeCoverData(coverUrl);
            }
            if (coverUrl.startsWith("http://") || coverUrl.startsWith("https://")) {
                return downloadCover(coverUrl);
            }
        }

        return null;
    }

    private Bitmap decodeCoverData(String dataUrl) {
        if (dataUrl.length() > MAX_COVER_DATA_CHARS) {
            Log.w(TAG, "Data cover terlalu besar untuk diproses");
            return null;
        }

        try {
            String base64 = dataUrl;
            if (dataUrl.startsWith("data:")) {
                int commaIndex = dataUrl.indexOf(',');
                if (commaIndex < 0) return null;
                base64 = dataUrl.substring(commaIndex + 1);
            }

            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            return decodeBitmap(bytes);
        } catch (Exception e) {
            Log.w(TAG, "Gagal mendekode data cover", e);
            return null;
        }
    }

    private Bitmap extractEmbeddedCover(String filePath) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            Uri uri = Uri.parse(filePath);
            String scheme = uri.getScheme();

            if ("content".equals(scheme)) {
                retriever.setDataSource(this, uri);
            } else if ("file".equals(scheme)) {
                String path = uri.getPath();
                retriever.setDataSource(path != null ? path : filePath);
            } else {
                retriever.setDataSource(filePath);
            }

            byte[] picture = retriever.getEmbeddedPicture();
            return picture != null ? decodeBitmap(picture) : null;
        } catch (Exception e) {
            Log.w(TAG, "Gagal membaca cover tertanam dari file audio", e);
            return null;
        } finally {
            try {
                retriever.release();
            } catch (Exception ignored) {
                // Resource native sudah tidak dipakai; kegagalan release
                // tidak memengaruhi pemutaran.
            }
        }
    }

    private Bitmap downloadCover(String coverUrl) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(coverUrl);
            String protocol = url.getProtocol();
            if (!"http".equals(protocol) && !"https".equals(protocol)) {
                return null;
            }

            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(10000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("User-Agent", "MusicFlow/1.0");

            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) {
                return null;
            }

            String contentType = connection.getContentType();
            if (contentType != null && !contentType.startsWith("image/")) {
                return null;
            }

            try (
                InputStream input = connection.getInputStream();
                ByteArrayOutputStream output = new ByteArrayOutputStream()
            ) {
                byte[] buffer = new byte[8192];
                int total = 0;
                int read;

                while ((read = input.read(buffer)) != -1) {
                    total += read;
                    if (total > MAX_COVER_BYTES) {
                        Log.w(TAG, "Cover dari URL melebihi batas ukuran");
                        return null;
                    }
                    output.write(buffer, 0, read);
                }

                return decodeBitmap(output.toByteArray());
            }
        } catch (Exception e) {
            Log.w(TAG, "Gagal mengunduh cover dari URL", e);
            return null;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private Bitmap decodeBitmap(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return null;

        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);

        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
            return null;
        }

        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = calculateInSampleSize(
            bounds.outWidth,
            bounds.outHeight,
            MAX_COVER_SIZE_PX
        );

        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
        if (bitmap == null) return null;

        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        float scale = Math.min(
            1f,
            (float) MAX_COVER_SIZE_PX / Math.max(width, height)
        );

        if (scale >= 1f) {
            return bitmap;
        }

        int targetWidth = Math.max(1, Math.round(width * scale));
        int targetHeight = Math.max(1, Math.round(height * scale));
        Bitmap scaled = Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true);

        if (scaled != bitmap) {
            bitmap.recycle();
        }

        return scaled;
    }

    private int calculateInSampleSize(int width, int height, int maxSize) {
        int sampleSize = 1;
        while (Math.max(width / sampleSize, height / sampleSize) > maxSize * 2) {
            sampleSize *= 2;
        }
        return sampleSize;
    }

    private PendingIntent createContentIntent() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, 0, intent, pendingIntentFlags());
    }

    private PendingIntent createActionIntent(String action, int requestCode) {
        Intent intent = new Intent(this, PlaybackService.class);
        intent.setAction(action);
        return PendingIntent.getService(this, requestCode, intent, pendingIntentFlags());
    }

    private int pendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }

    private void updateWakeLock(boolean playing) {
        if (wakeLock == null) return;

        try {
            if (playing && !wakeLock.isHeld()) {
                wakeLock.acquire();
            } else if (!playing && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception e) {
            Log.w(TAG, "Gagal memperbarui wake lock", e);
        }
    }

    private void releaseWakeLock() {
        if (wakeLock == null) return;
        try {
            if (wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception e) {
            Log.w(TAG, "Gagal melepas wake lock", e);
        }
    }

    private String valueOrEmpty(String value) {
        return value != null ? value : "";
    }
}
