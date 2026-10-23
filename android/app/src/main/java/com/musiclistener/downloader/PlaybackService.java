package com.musiclistener.downloader;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

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

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_DURATION = "duration";
    public static final String EXTRA_POSITION = "position";
    public static final String EXTRA_IS_PLAYING = "isPlaying";

    private static final String CHANNEL_ID = "musicflow_playback";
    private static final int NOTIFICATION_ID = 2107;

    public static volatile boolean isRunning = false;

    private MediaSessionCompat mediaSession;
    private PowerManager.WakeLock wakeLock;

    private String title = "";
    private String artist = "";
    private String album = "";
    private long durationMs = 0;
    private long positionMs = 0;
    private boolean isPlaying = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        createWakeLock();
        createMediaSession();
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

        // Wajib dipanggil cepat setelah startForegroundService, termasuk saat
        // service dihidupkan ulang oleh aksi notifikasi.
        promoteToForeground();

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

        updateWakeLock(isPlaying);
        updateMediaSession();
    }

    private void updateMediaSession() {
        if (mediaSession == null) return;

        if (!title.isEmpty()) {
            MediaMetadataCompat metadata = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs)
                .build();
            mediaSession.setMetadata(metadata);
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
