package com.musiclistener.downloader;

import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.*;
import java.net.*;
import java.util.Enumeration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Plugin native untuk menjalankan micro HTTP server di Android
 * guna membagikan lagu secara offline / peer-to-peer (SHAREit-style)
 */
@CapacitorPlugin(name = "ShareServer")
public class ShareServerPlugin extends Plugin {

    private static final String TAG = "ShareServerPlugin";
    private ServerSocket serverSocket = null;
    private ExecutorService threadPool = null;
    private volatile boolean isRunning = false;

    // Data sesi berbagi aktif
    private String activeToken = "";
    private String activeFilePath = "";
    private String activeTitle = "";
    private String activeArtist = "";
    private long activeDuration = 0;
    private long activeFileSize = 0;
    private String activeCoverUrl = "";
    private volatile String transferStatus = "waiting"; // "waiting", "transferring", "completed"
    private volatile int transferProgress = 0;

    /**
     * Mendapatkan alamat IP lokal perangkat (Wi-Fi atau Hotspot Tethering)
     * Mengabaikan interface virtual/cellular dan memprioritaskan wlan / ap
     */
    @PluginMethod
    public void getLocalIp(PluginCall call) {
        String bestIp = null;
        int bestScore = -1;
        JSArray allIps = new JSArray();

        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface iface = interfaces.nextElement();
                // Lewati interface loopback atau yang tidak aktif
                if (iface.isLoopback() || !iface.isUp()) continue;

                String ifaceName = iface.getName().toLowerCase();
                // Abaikan interface dummy, cellular rmnet, tunnel, atau p2p
                if (ifaceName.contains("dummy") || ifaceName.contains("p2p") ||
                    ifaceName.contains("tun") || ifaceName.contains("rmnet") ||
                    ifaceName.contains("sit") || ifaceName.contains("ccmni")) {
                    continue;
                }

                int score = 10;
                if (ifaceName.startsWith("wlan") || ifaceName.startsWith("swlan")) {
                    score = 100; // Wi-Fi client
                } else if (ifaceName.startsWith("ap") || ifaceName.startsWith("softap")) {
                    score = 90; // Hotspot / Tethering
                } else if (ifaceName.startsWith("eth")) {
                    score = 80; // Ethernet
                }

                Enumeration<InetAddress> addresses = iface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress addr = addresses.nextElement();
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                        String host = addr.getHostAddress();
                        if (host != null && !host.startsWith("127.") && !host.startsWith("169.254.")) {
                            JSObject obj = new JSObject();
                            String displayName = iface.getDisplayName() != null ? iface.getDisplayName() : iface.getName();
                            obj.put("name", displayName + " (" + host + ")");
                            obj.put("ip", host);
                            allIps.put(obj);

                            if (score > bestScore) {
                                bestScore = score;
                                bestIp = host;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Gagal mendapatkan IP lokal: " + e.getMessage());
        }

        if (bestIp == null) {
            bestIp = "127.0.0.1";
        }

        JSObject ret = new JSObject();
        ret.put("ip", bestIp);
        ret.put("allIps", allIps);
        call.resolve(ret);
    }

    /**
     * Memulai server HTTP mini untuk melayani permintaan unduh lagu
     */
    @PluginMethod
    public void startServer(PluginCall call) {
        int port = call.getInt("port", 3001);
        activeToken = call.getString("token", "");
        activeFilePath = call.getString("filePath", "");
        if (activeFilePath != null && activeFilePath.startsWith("file://")) {
            activeFilePath = activeFilePath.substring(7);
        }
        activeTitle = call.getString("title", "Lagu");
        activeArtist = call.getString("artist", "Artis Tidak Diketahui");
        activeDuration = call.getInt("duration", 0);
        activeFileSize = call.getInt("fileSize", 0);
        activeCoverUrl = call.getString("coverUrl", "");
        transferStatus = "waiting";
        transferProgress = 0;

        stopServerInternal();

        try {
            // Bind ke semua interface (0.0.0.0)
            serverSocket = new ServerSocket(port);
            isRunning = true;
            threadPool = Executors.newCachedThreadPool();

            // Jalankan loop accept di background thread
            new Thread(this::listenConnections).start();

            Log.i(TAG, "Micro HTTP server aktif pada port " + port + " untuk token " + activeToken);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("port", port);
            call.resolve(ret);
        } catch (IOException e) {
            Log.e(TAG, "Gagal memulai ServerSocket: " + e.getMessage());
            call.reject("Gagal memulai server lokal pada port " + port + ": " + e.getMessage());
        }
    }

    /**
     * Menghentikan server HTTP mini
     */
    @PluginMethod
    public void stopServer(PluginCall call) {
        stopServerInternal();
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    /**
     * Mendapatkan status transfer terkini (dipoll oleh pengirim)
     */
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("status", transferStatus);
        ret.put("progress", transferProgress);
        call.resolve(ret);
    }

    private void stopServerInternal() {
        isRunning = false;
        if (serverSocket != null) {
            try {
                serverSocket.close();
            } catch (IOException ignored) {}
            serverSocket = null;
        }
        if (threadPool != null) {
            threadPool.shutdownNow();
            threadPool = null;
        }
        transferStatus = "waiting";
        transferProgress = 0;
    }

    private void listenConnections() {
        while (isRunning && serverSocket != null && !serverSocket.isClosed()) {
            try {
                Socket client = serverSocket.accept();
                if (threadPool != null && !threadPool.isShutdown()) {
                    threadPool.execute(() -> handleClient(client));
                }
            } catch (IOException e) {
                if (isRunning) {
                    Log.w(TAG, "Error accept client socket: " + e.getMessage());
                }
            }
        }
    }

    private void handleClient(Socket socket) {
        try (
            BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            OutputStream out = socket.getOutputStream()
        ) {
            String requestLine = in.readLine();
            if (requestLine == null || requestLine.isEmpty()) return;

            String[] parts = requestLine.split(" ");
            if (parts.length < 2) return;

            String method = parts[0];
            String uri = parts[1];

            // Baca sisa header HTTP sampai baris kosong
            String line;
            while ((line = in.readLine()) != null && !line.isEmpty()) {}

            // Tangani CORS Preflight (OPTIONS)
            if ("OPTIONS".equalsIgnoreCase(method)) {
                sendCorsResponse(out);
                return;
            }

            // Endpoint: /api/share/info?token=XYZ
            if (uri.startsWith("/api/share/info")) {
                handleInfoRequest(uri, out);
                return;
            }

            // Endpoint: /api/share/download?token=XYZ
            if (uri.startsWith("/api/share/download")) {
                handleDownloadRequest(uri, out);
                return;
            }

            // Endpoint: /api/share/status
            if (uri.startsWith("/api/share/status")) {
                handleStatusRequest(out);
                return;
            }

            // Default 404
            String notFound = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\nNot Found";
            out.write(notFound.getBytes());
            out.flush();

        } catch (Exception e) {
            Log.w(TAG, "Error menangani permintaan client: " + e.getMessage());
        } finally {
            try {
                socket.close();
            } catch (IOException ignored) {}
        }
    }

    private void sendCorsResponse(OutputStream out) throws IOException {
        String resp = "HTTP/1.1 200 OK\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
                "Access-Control-Allow-Headers: *\r\n" +
                "Content-Length: 0\r\n" +
                "Connection: close\r\n\r\n";
        out.write(resp.getBytes());
        out.flush();
    }

    private void handleInfoRequest(String uri, OutputStream out) throws IOException {
        String token = extractQueryParam(uri, "token");
        if (!activeToken.isEmpty() && !activeToken.equals(token)) {
            sendError(out, 403, "Token tidak valid");
            return;
        }

        File file = new File(activeFilePath);
        long fileSize = file.exists() ? file.length() : activeFileSize;

        String safeTitle = escapeJson(activeTitle);
        String safeArtist = escapeJson(activeArtist);
        String safeCover = escapeJson(activeCoverUrl);

        String json = String.format(
                "{\"title\":\"%s\",\"artist\":\"%s\",\"duration\":%d,\"fileSize\":%d,\"coverUrl\":\"%s\",\"token\":\"%s\"}",
                safeTitle, safeArtist, activeDuration, fileSize, safeCover, activeToken
        );

        byte[] jsonBytes = json.getBytes("UTF-8");
        String header = "HTTP/1.1 200 OK\r\n" +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Content-Length: " + jsonBytes.length + "\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Connection: close\r\n\r\n";

        out.write(header.getBytes());
        out.write(jsonBytes);
        out.flush();
    }

    private void handleDownloadRequest(String uri, OutputStream out) throws IOException {
        String token = extractQueryParam(uri, "token");
        if (!activeToken.isEmpty() && !activeToken.equals(token)) {
            sendError(out, 403, "Token tidak valid");
            return;
        }

        File file = new File(activeFilePath);
        if (!file.exists() || !file.canRead()) {
            sendError(out, 404, "File audio tidak ditemukan di penyimpanan perangkat");
            return;
        }

        long totalSize = file.length();
        transferStatus = "transferring";
        transferProgress = 0;

        String header = "HTTP/1.1 200 OK\r\n" +
                "Content-Type: audio/mpeg\r\n" +
                "Content-Length: " + totalSize + "\r\n" +
                "Content-Disposition: attachment; filename=\"musicflow_track.mp3\"\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Connection: close\r\n\r\n";

        out.write(header.getBytes());
        out.flush();

        // Streaming chunk buffer
        byte[] buffer = new byte[32 * 1024]; // 32 KB chunk
        long bytesSent = 0;

        try (FileInputStream fis = new FileInputStream(file)) {
            int read;
            while ((read = fis.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                bytesSent += read;
                if (totalSize > 0) {
                    transferProgress = (int) ((bytesSent * 100) / totalSize);
                }
            }
            out.flush();
            transferStatus = "completed";
            transferProgress = 100;
        } catch (Exception e) {
            transferStatus = "error";
            Log.e(TAG, "Gagal streaming audio file: " + e.getMessage());
        }
    }

    private void handleStatusRequest(OutputStream out) throws IOException {
        String json = String.format("{\"status\":\"%s\",\"progress\":%d}", transferStatus, transferProgress);
        byte[] bytes = json.getBytes("UTF-8");
        String header = "HTTP/1.1 200 OK\r\n" +
                "Content-Type: application/json\r\n" +
                "Content-Length: " + bytes.length + "\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Connection: close\r\n\r\n";
        out.write(header.getBytes());
        out.write(bytes);
        out.flush();
    }

    private void sendError(OutputStream out, int code, String message) throws IOException {
        String resp = String.format("HTTP/1.1 %d %s\r\nContent-Type: text/plain\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n%s",
                code, code == 404 ? "Not Found" : "Forbidden", message);
        out.write(resp.getBytes());
        out.flush();
    }

    private String extractQueryParam(String uri, String param) {
        int qIdx = uri.indexOf('?');
        if (qIdx == -1) return "";
        String query = uri.substring(qIdx + 1);
        String[] pairs = query.split("&");
        for (String pair : pairs) {
            String[] kv = pair.split("=");
            if (kv.length == 2 && kv[0].equalsIgnoreCase(param)) {
                return URLDecoder.decode(kv[1]);
            }
        }
        return "";
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "").replace("\r", "");
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        stopServerInternal();
    }
}
