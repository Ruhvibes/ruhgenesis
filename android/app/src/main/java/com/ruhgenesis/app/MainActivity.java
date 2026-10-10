package com.ruhgenesis.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** RuhGenesis — WebView wrapper for the 3D living-universe simulation.
 *  Lean v1: no ads, no Firebase. Fullscreen immersive + keep screen on. */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Keep the screen on during gameplay.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // 3D needs a decent viewport + hardware rendering.
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.setWebViewClient(new WebViewClient());
        web.addJavascriptInterface(new AppBridge(), "Android");
        setContentView(web);
        enableImmersive();

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("file:///android_asset/www/index.html");
    }

    /** Sticky immersive fullscreen: no status/nav bars over the game. */
    private void enableImmersive() {
        try {
            View decor = getWindow().getDecorView();
            int flags = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
            decor.setSystemUiVisibility(flags);
        } catch (Exception ignored) {}
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enableImmersive();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        try { if (web != null) web.onPause(); } catch (Exception ignored) {}
    }

    @Override
    protected void onResume() {
        super.onResume();
        try { if (web != null) web.onResume(); } catch (Exception ignored) {}
        enableImmersive();
    }

    @Override
    protected void onDestroy() {
        try { if (web != null) { web.destroy(); web = null; } } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
            return;
        }
        // Confirm before exiting the game.
        new AlertDialog.Builder(this)
                .setTitle("Exit RuhGenesis?")
                .setMessage("Your world is autosaved. Exit the game?")
                .setPositiveButton("Exit", (d, w) -> MainActivity.super.onBackPressed())
                .setNegativeButton("Stay", null)
                .show();
    }

    /** Minimal JS bridge: window.Android.closeApp() / window.Android.vibrate(ms).
     *  Guarded: JS should feature-detect `window.Android` before calling. */
    private class AppBridge {
        @JavascriptInterface
        public void closeApp() {
            runOnUiThread(() -> {
                try { finish(); } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void vibrate(long ms) {
            try {
                long dur = Math.max(0, Math.min(ms, 500));
                if (dur == 0) return;
                Vibrator v;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    VibratorManager vm = (VibratorManager)
                            getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                    v = vm != null ? vm.getDefaultVibrator() : null;
                } else {
                    v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                }
                if (v == null || !v.hasVibrator()) return;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    v.vibrate(VibrationEffect.createOneShot(dur,
                            VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(dur);
                }
            } catch (Exception ignored) {}
        }
    }
}
