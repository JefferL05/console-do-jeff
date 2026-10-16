package com.jefferl05.ourodosubsolo;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.util.AtomicFile;
import android.view.HapticFeedbackConstants;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import org.json.JSONObject;

@CapacitorPlugin(name = "OuroNative")
public class OuroNativePlugin extends Plugin {
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private boolean focusHeld = false;
    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        focusHeld = change == AudioManager.AUDIOFOCUS_GAIN;
        JSObject data = new JSObject(); data.put("available", focusHeld);
        getBridge().triggerWindowJSEvent("ouro:audio-focus", data.toString());
    };
    private AtomicFile stateFile() { return new AtomicFile(new File(getContext().getFilesDir(), "ouro-state-v1.json")); }
    private String readLimited(InputStream input, int limit) throws Exception {
        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int size;
            while ((size = stream.read(buffer)) != -1) {
                if (output.size() + size > limit) throw new IllegalArgumentException("Arquivo excede o limite permitido.");
                output.write(buffer, 0, size);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }
    private void validateValues(JSONObject values) throws Exception {
        if (values.length() > 40) throw new IllegalArgumentException("Quantidade de saves inválida.");
        for (Iterator<String> it = values.keys(); it.hasNext();) {
            String key = it.next();
            if (!key.startsWith("ouro-") || key.length() > 100 || !(values.get(key) instanceof String) || values.getString(key).length() > 1000000) throw new IllegalArgumentException("Save inválido.");
        }
    }
    @PluginMethod public void loadState(PluginCall call) {
        AtomicFile file = stateFile();
        try {
            JSObject result = new JSObject();
            if (!file.getBaseFile().exists() && !new File(file.getBaseFile().getPath() + ".bak").exists()) {
                result.put("initialized", false); result.put("values", new JSObject());
            } else {
                JSONObject envelope = new JSONObject(readLimited(file.openRead(), 12000000));
                if (envelope.getInt("version") != 1) throw new IllegalArgumentException("Versão nativa incompatível.");
                JSONObject values = envelope.getJSONObject("values"); validateValues(values);
                result.put("initialized", true); result.put("values", values);
            }
            call.resolve(result);
        } catch (Exception error) { call.reject("Não foi possível ler o save Android. Os dados foram preservados.", error); }
    }
    @PluginMethod public void saveState(PluginCall call) {
        AtomicFile file = stateFile(); FileOutputStream stream = null;
        try {
            JSObject values = call.getObject("values");
            if (values == null) throw new IllegalArgumentException("Dados ausentes.");
            validateValues(values);
            JSONObject envelope = new JSONObject(); envelope.put("version", 1); envelope.put("values", values);
            byte[] data = envelope.toString().getBytes(StandardCharsets.UTF_8);
            if (data.length > 12000000) throw new IllegalArgumentException("Save muito grande.");
            stream = file.startWrite(); stream.write(data); file.finishWrite(stream); call.resolve();
        } catch (Exception error) { if (stream != null) file.failWrite(stream); call.reject("Não foi possível gravar o save Android.", error); }
    }
    @PluginMethod public void importSave(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT); intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
        startActivityForResult(call, intent, "fileImported");
    }
    @ActivityCallback private void fileImported(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { JSObject data = new JSObject(); data.put("cancelled", true); call.resolve(data); return; }
        try {
            String raw = readLimited(getContext().getContentResolver().openInputStream(result.getData().getData()), 1000000);
            JSObject data = new JSObject(); data.put("raw", raw); call.resolve(data);
        } catch (Exception error) { call.reject("Não foi possível importar o arquivo.", error); }
    }
    @PluginMethod public void exportSave(PluginCall call) {
        String raw = call.getString("raw"), name = call.getString("name", "ouro-campanha.json");
        if (raw == null || raw.length() > 1000000) { call.reject("Save inválido ou muito grande."); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT); intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, name.replaceAll("[^A-Za-z0-9._-]", "_"));
        startActivityForResult(call, intent, "fileExported");
    }
    @ActivityCallback private void fileExported(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { JSObject data = new JSObject(); data.put("cancelled", true); call.resolve(data); return; }
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
            if (stream == null) throw new IllegalStateException("Destino indisponível.");
            stream.write(call.getString("raw", "").getBytes(StandardCharsets.UTF_8)); call.resolve();
        } catch (Exception error) { call.reject("Não foi possível exportar o arquivo.", error); }
    }
    @PluginMethod public void requestAudioFocus(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (audioManager == null) audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            int result = AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
            if (!focusHeld) {
                if (Build.VERSION.SDK_INT >= 26) {
                    if (focusRequest == null) focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                        .setOnAudioFocusChangeListener(focusListener).setWillPauseWhenDucked(true).build();
                    result = audioManager.requestAudioFocus(focusRequest);
                } else result = audioManager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
            }
            focusHeld = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
            JSObject data = new JSObject(); data.put("available", focusHeld); call.resolve(data);
        });
    }
    private void releaseFocus() {
        if (audioManager != null) {
            if (Build.VERSION.SDK_INT >= 26 && focusRequest != null) audioManager.abandonAudioFocusRequest(focusRequest);
            else audioManager.abandonAudioFocus(focusListener);
        }
        focusHeld = false;
    }
    @PluginMethod public void abandonAudioFocus(PluginCall call) { getActivity().runOnUiThread(() -> { releaseFocus(); call.resolve(); }); }
    @PluginMethod public void haptic(PluginCall call) {
        getActivity().runOnUiThread(() -> { getBridge().getWebView().performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK); call.resolve(); });
    }
    @PluginMethod public void ready(PluginCall call) { ((MainActivity) getActivity()).webReady = true; call.resolve(); }
    @PluginMethod public void exit(PluginCall call) { getActivity().runOnUiThread(() -> { releaseFocus(); getActivity().finish(); call.resolve(); }); }
    @Override protected void handleOnPause() { releaseFocus(); }
    @Override protected void handleOnDestroy() { releaseFocus(); }
}
