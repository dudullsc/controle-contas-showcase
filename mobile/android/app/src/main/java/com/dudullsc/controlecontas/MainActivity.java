package com.dudullsc.controlecontas;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {
    private static final int REQUEST_NOTIFICATIONS = 1001;
    private String bridgeScript;
    private ShareIntentHelper shareHelper;
    private Object shareJsBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        shareHelper = new ShareIntentHelper(this);
        shareJsBridge = shareHelper.createJsBridge();
        setupVisibleSystemBars();
        bridgeScript = loadAssetText("public/cc-bridge.js");
        requestNotificationPermissionOnLaunch();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && bridge.getWebView() != null) {
            bridge.getWebView().setForceDarkAllowed(false);
        }

        if (bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(shareJsBridge, "CCShareAndroid");
        }

        bridge.getWebView().setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                setupVisibleSystemBars();
                applyWebViewSafeInsets();
                if (bridgeScript != null && !bridgeScript.isEmpty()) {
                    view.evaluateJavascript(bridgeScript, null);
                }
                // O plugin StatusBar do Capacitor pode sobrescrever o estilo; reaplica ícones escuros.
                view.postDelayed(() -> setupVisibleSystemBars(), 250);
                if (shareHelper != null) {
                    shareHelper.notifyWebView(view);
                }
            }
        });

        // Após o layout do Capacitor, reaplica insets
        bridge.getWebView().post(this::applyWebViewSafeInsets);

        handleIncomingShare(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingShare(intent);
    }

    private void handleIncomingShare(Intent intent) {
        if (shareHelper == null || intent == null) {
            return;
        }
        // Fluxo legado (caso ainda chegue SEND direto) + trampolim ShareReceiverActivity
        boolean consumed = shareHelper.consumeShareIntent(intent);
        boolean fromTrampoline = shareHelper.isShareReady(intent);
        if (fromTrampoline) {
            shareHelper.clearShareReadyFlag(intent);
        }
        if ((consumed || fromTrampoline) && bridge.getWebView() != null) {
            shareHelper.notifyWebView(bridge.getWebView());
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        setupVisibleSystemBars();
        applyWebViewSafeInsets();
    }

    /**
     * Status bar sempre visível (hora, bateria) e WebView abaixo dela.
     */
    private void setupVisibleSystemBars() {
        Window window = getWindow();

        // Conteúdo NÃO desenha sob a status bar
        WindowCompat.setDecorFitsSystemWindows(window, true);

        window.setStatusBarColor(Color.WHITE);
        window.setNavigationBarColor(Color.WHITE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(true);
            window.setNavigationBarContrastEnforced(true);
        }

        View decor = window.getDecorView();
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(window, decor);
        if (controller != null) {
            controller.show(WindowInsetsCompat.Type.statusBars());
            controller.show(WindowInsetsCompat.Type.navigationBars());
            controller.setAppearanceLightStatusBars(true);
            controller.setAppearanceLightNavigationBars(true);
            controller.setSystemBarsBehavior(
                    WindowInsetsControllerCompat.BEHAVIOR_DEFAULT
            );
        }
    }

    /**
     * Em Android 14/15 o edge-to-edge às vezes ignora decorFits.
     * Garante padding real no WebView para o menu não ficar sob a barra.
     */
    private void applyWebViewSafeInsets() {
        try {
            WebView webView = bridge.getWebView();
            if (webView == null) {
                return;
            }
            ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
                Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
                // Só aplica se o sistema não estiver insetando (padding ainda 0 e top > 0)
                int top = bars.top;
                int bottom = bars.bottom;
                int left = bars.left;
                int right = bars.right;
                // Evita padding duplo absurdo: limita e só seta se necessário
                if (top > 0 || bottom > 0 || left > 0 || right > 0) {
                    // Se decorFits já insetou, getRootWindowInsets no parent pode dar 0 no content;
                    // usar padding só quando o webview está colado no topo da tela
                    View parent = (View) v.getParent();
                    int[] loc = new int[2];
                    v.getLocationOnScreen(loc);
                    if (loc[1] < top / 2) {
                        v.setPadding(left, top, right, bottom);
                    } else {
                        v.setPadding(0, 0, 0, 0);
                    }
                }
                return windowInsets;
            });
            ViewCompat.requestApplyInsets(webView);

            // Fallback: se o WebView está sob a status bar, empurra via margin no parent
            webView.post(() -> {
                int[] loc = new int[2];
                webView.getLocationOnScreen(loc);
                WindowInsetsCompat wi = ViewCompat.getRootWindowInsets(webView);
                if (wi == null) {
                    return;
                }
                int statusTop = wi.getInsets(WindowInsetsCompat.Type.statusBars()).top;
                if (statusTop > 0 && loc[1] < statusTop / 2) {
                    ViewGroup.MarginLayoutParams lp =
                            (ViewGroup.MarginLayoutParams) webView.getLayoutParams();
                    if (lp != null && lp.topMargin < statusTop) {
                        lp.topMargin = statusTop;
                        webView.setLayoutParams(lp);
                    }
                }
            });
        } catch (Exception ignored) {
        }
    }

    private String loadAssetText(String path) {
        try (InputStream is = getAssets().open(path);
             BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append('\n');
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private void requestNotificationPermissionOnLaunch() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return;
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED) {
            return;
        }
        ActivityCompat.requestPermissions(
                this,
                new String[] { Manifest.permission.POST_NOTIFICATIONS },
                REQUEST_NOTIFICATIONS
        );
    }
}
