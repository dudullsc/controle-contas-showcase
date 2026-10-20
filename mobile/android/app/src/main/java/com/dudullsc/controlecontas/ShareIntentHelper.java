package com.dudullsc.controlecontas;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Recebe ACTION_SEND (PDF/imagem) e expõe o arquivo ao WebView em chunks base64.
 * Estado pendente é estático: a ShareReceiverActivity lê o URI e o MainActivity notifica o JS.
 */
public final class ShareIntentHelper {
    public static final String EXTRA_SHARE_READY = "com.dudullsc.controlecontas.SHARE_READY";

    private static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final int CHUNK_CHARS = 240_000;
    private static final Object LOCK = new Object();

    private static String fileName = "";
    private static String mimeType = "";
    private static int sizeBytes = 0;
    private static final List<String> chunks = new ArrayList<>();
    private static String errorMessage = null;
    private static boolean pending = false;

    private final Context appContext;

    public ShareIntentHelper(Context context) {
        this.appContext = context.getApplicationContext();
    }

    public Object createJsBridge() {
        return new ShareJsBridge();
    }

    public boolean consumeShareIntent(Intent intent) {
        if (intent == null) {
            return false;
        }
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action)) {
            return false;
        }

        Uri uri = null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
        } else {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        if (uri == null) {
            return false;
        }

        synchronized (LOCK) {
            clearPendingLocked();
            try {
                loadFromUri(uri, intent.getType());
                pending = true;
                errorMessage = null;
            } catch (Exception e) {
                clearPendingLocked();
                pending = true;
                errorMessage =
                        e.getMessage() != null
                                ? e.getMessage()
                                : "Falha ao ler o arquivo compartilhado";
            }
        }

        // Evita reprocessar o mesmo intent em recreate/onNewIntent.
        intent.setAction(null);
        intent.removeExtra(Intent.EXTRA_STREAM);
        return true;
    }

    public boolean isShareReady(Intent intent) {
        return intent != null && intent.getBooleanExtra(EXTRA_SHARE_READY, false);
    }

    public void clearShareReadyFlag(Intent intent) {
        if (intent != null) {
            intent.removeExtra(EXTRA_SHARE_READY);
        }
    }

    public boolean hasPending() {
        synchronized (LOCK) {
            return pending;
        }
    }

    public void notifyWebView(WebView webView) {
        final boolean shouldNotify;
        final String event;
        final String detail;
        synchronized (LOCK) {
            if (webView == null || !pending) {
                return;
            }
            shouldNotify = true;
            event = errorMessage != null ? "cc-share-error" : "cc-share-received";
            detail = errorMessage != null ? JSONObject.quote(errorMessage) : "null";
        }
        if (!shouldNotify) {
            return;
        }
        webView.post(
                () ->
                        webView.evaluateJavascript(
                                "(function(){try{window.dispatchEvent(new CustomEvent('"
                                        + event
                                        + "',{detail:"
                                        + detail
                                        + "}));}catch(e){}})();",
                                null));
    }

    private void loadFromUri(Uri uri, String intentMime) throws Exception {
        ContentResolver cr = appContext.getContentResolver();
        String name = queryDisplayName(cr, uri);
        String mime = cr.getType(uri);
        if (mime == null || mime.isEmpty()) {
            mime = intentMime;
        }
        if (mime == null) {
            mime = "application/octet-stream";
        }

        byte[] data;
        try (InputStream in = cr.openInputStream(uri)) {
            if (in == null) {
                throw new IllegalStateException("Não foi possível abrir o arquivo");
            }
            data = readLimited(in, MAX_BYTES + 1);
        }

        if (data.length == 0) {
            throw new IllegalStateException("Arquivo vazio");
        }
        if (data.length > MAX_BYTES) {
            throw new IllegalStateException("Arquivo maior que 5 MB");
        }

        String detectedMime = detectMime(data);
        if (detectedMime == null) {
            throw new IllegalStateException("Tipo não permitido. Envie JPG, PNG, WEBP ou PDF");
        }

        if (name == null || name.trim().isEmpty()) {
            String ext = extensionForMime(detectedMime);
            name = "comprovante." + ext;
        }

        String b64 = Base64.encodeToString(data, Base64.NO_WRAP);
        chunks.clear();
        for (int i = 0; i < b64.length(); i += CHUNK_CHARS) {
            int end = Math.min(i + CHUNK_CHARS, b64.length());
            chunks.add(b64.substring(i, end));
        }

        fileName = name;
        mimeType = detectedMime;
        sizeBytes = data.length;
    }

    private static byte[] readLimited(InputStream in, int maxInclusive) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int total = 0;
        int n;
        while ((n = in.read(buf)) != -1) {
            total += n;
            if (total > maxInclusive) {
                out.write(buf, 0, n);
                return out.toByteArray();
            }
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }

    private static String queryDisplayName(ContentResolver cr, Uri uri) {
        try (Cursor cursor =
                cr.query(uri, new String[] {OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) {
                    return cursor.getString(idx);
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private static String detectMime(byte[] data) {
        if (data.length < 12) {
            return null;
        }
        if ((data[0] & 0xff) == 0xff && (data[1] & 0xff) == 0xd8 && (data[2] & 0xff) == 0xff) {
            return "image/jpeg";
        }
        if (data[0] == (byte) 0x89 && data[1] == 0x50 && data[2] == 0x4e && data[3] == 0x47) {
            return "image/png";
        }
        if (data[0] == 'R'
                && data[1] == 'I'
                && data[2] == 'F'
                && data[3] == 'F'
                && data[8] == 'W'
                && data[9] == 'E'
                && data[10] == 'B'
                && data[11] == 'P') {
            return "image/webp";
        }
        if (data[0] == '%' && data[1] == 'P' && data[2] == 'D' && data[3] == 'F') {
            return "application/pdf";
        }
        return null;
    }

    private static String extensionForMime(String mime) {
        switch (mime) {
            case "image/jpeg":
                return "jpg";
            case "image/png":
                return "png";
            case "image/webp":
                return "webp";
            case "application/pdf":
                return "pdf";
            default:
                return "bin";
        }
    }

    private static void clearPendingLocked() {
        pending = false;
        errorMessage = null;
        fileName = "";
        mimeType = "";
        sizeBytes = 0;
        chunks.clear();
    }

    private static void clearPending() {
        synchronized (LOCK) {
            clearPendingLocked();
        }
    }

    public class ShareJsBridge {
        @JavascriptInterface
        public boolean hasPendingShare() {
            synchronized (LOCK) {
                return pending;
            }
        }

        @JavascriptInterface
        public String getPendingShareMeta() {
            synchronized (LOCK) {
                try {
                    JSONObject o = new JSONObject();
                    o.put("pending", pending);
                    o.put("error", errorMessage);
                    o.put("fileName", fileName);
                    o.put("mimeType", mimeType);
                    o.put("sizeBytes", sizeBytes);
                    o.put("chunkCount", chunks.size());
                    return o.toString();
                } catch (Exception e) {
                    return "{\"pending\":false}";
                }
            }
        }

        @JavascriptInterface
        public String getPendingShareChunk(int index) {
            synchronized (LOCK) {
                if (index < 0 || index >= chunks.size()) {
                    return "";
                }
                return chunks.get(index);
            }
        }

        @JavascriptInterface
        public void clearPendingShare() {
            clearPending();
        }
    }
}
