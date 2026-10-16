package com.jefferl05.ourodosubsolo;

import android.os.Bundle;
import android.content.pm.ApplicationInfo;
import android.webkit.WebView;
import android.view.View;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    volatile boolean webReady = false;

    @Override public void onCreate(Bundle state) {
        registerPlugin(OuroNativePlugin.class);
        super.onCreate(state);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        View root = findViewById(android.R.id.content);
        root.setBackgroundColor(0xff102621);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets keyboard = insets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
            return insets;
        });
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (webReady && getBridge() != null) getBridge().triggerWindowJSEvent("ouro:native-back");
                else finish();
            }
        });
    }

    @Override public void onPause() {
        if (getBridge() != null) getBridge().triggerWindowJSEvent("ouro:native-pause");
        super.onPause();
    }

    @Override public void onResume() {
        super.onResume();
        if (getBridge() != null) getBridge().triggerWindowJSEvent("ouro:native-resume");
    }
}
