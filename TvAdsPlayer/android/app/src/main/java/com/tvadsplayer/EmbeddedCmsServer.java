package com.tvadsplayer;

import android.content.Context;
import android.os.Environment;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONArray;
import org.json.JSONObject;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoHTTPD.IHTTPSession;
import fi.iki.elonen.NanoHTTPD.Method;
import fi.iki.elonen.NanoHTTPD.Response;
import fi.iki.elonen.NanoHTTPD.Response.Status;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class EmbeddedCmsServer extends NanoHTTPD {
    private static final String TAG = "EmbeddedCmsServer";
    public static final int DEFAULT_PORT = 9090;
    private final ReactApplicationContext reactContext;

    public EmbeddedCmsServer(ReactApplicationContext reactContext, int port) {
        super(port);
        this.reactContext = reactContext;
        try {
            File nvDir = getNvsignDir();
            File tmpDir = new File(nvDir, ".tmp");
            if (!tmpDir.exists()) {
                tmpDir.mkdirs();
            }
            System.setProperty("java.io.tmpdir", tmpDir.getAbsolutePath());
        } catch (Exception ignored) {}
    }

    private File getNvsignDir() {
        File extDir = Environment.getExternalStorageDirectory();
        File nvsign = new File(extDir, "nvsign");
        if (!nvsign.exists()) {
            nvsign.mkdirs();
        }
        return nvsign;
    }

    private File getConfigFile() {
        return new File(getNvsignDir(), "config.json");
    }

    private JSONObject readConfigJson() {
        try {
            File configFile = getConfigFile();
            if (configFile.exists()) {
                FileInputStream fis = new FileInputStream(configFile);
                byte[] data = new byte[(int) configFile.length()];
                fis.read(data);
                fis.close();
                return new JSONObject(new String(data, "UTF-8"));
            }
        } catch (Exception e) {
            Log.w(TAG, "Error reading config.json", e);
        }
        // Default Config
        JSONObject defaultConfig = new JSONObject();
        try {
            defaultConfig.put("slideDuration", 5000);
            defaultConfig.put("tickerText", "");
            defaultConfig.put("tickerTextColor", "#FFFFFF");
            defaultConfig.put("tickerBgColor", "#000000");
            defaultConfig.put("tickerPosition", "bottom");
            defaultConfig.put("tickerFontSize", 16);
            defaultConfig.put("tickerFontFamily", "sans-serif");
            defaultConfig.put("usePendrive", false);
            defaultConfig.put("resizeMode", "stretch");
            defaultConfig.put("orientation", "horizontal");
            defaultConfig.put("layoutMode", "auto");
            defaultConfig.put("sectionRatio", "50_50");
        } catch (Exception ignored) {}
        return defaultConfig;
    }

    private void writeConfigJson(JSONObject config) {
        try {
            File configFile = getConfigFile();
            FileOutputStream fos = new FileOutputStream(configFile);
            fos.write(config.toString(2).getBytes("UTF-8"));
            fos.close();
        } catch (Exception e) {
            Log.e(TAG, "Error writing config.json", e);
        }
    }

    private void deleteRecursive(File fileOrDirectory) {
        if (fileOrDirectory.isDirectory()) {
            File[] children = fileOrDirectory.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        fileOrDirectory.delete();
    }

    public void emitEventToJS(String eventName, String payloadJson) {
        if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
            try {
                WritableMap map = Arguments.createMap();
                map.putString("type", eventName);
                map.putString("payload", payloadJson);
                reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("embeddedCmsEvent", map);
            } catch (Exception e) {
                Log.e(TAG, "Error emitting event to JS", e);
            }
        }
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        Method method = session.getMethod();

        try {
            if (Method.GET.equals(method) && uri.equals("/")) {
                return newFixedLengthResponse(Status.OK, "text/html", getCmsHtml());
            }

            if (Method.GET.equals(method) && uri.equals("/api/config")) {
                JSONObject config = readConfigJson();
                return newFixedLengthResponse(Status.OK, "application/json", config.toString());
            }

            if (Method.POST.equals(method) && uri.equals("/api/config")) {
                Map<String, String> files = new HashMap<>();
                session.parseBody(files);
                String postData = files.get("postData");
                if (postData != null) {
                    JSONObject newConfig = new JSONObject(postData);
                    writeConfigJson(newConfig);
                    emitEventToJS("config-updated", newConfig.toString());
                    emitEventToJS("media-updated", "config-save");
                    return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true}");
                }
            }

            if (Method.GET.equals(method) && uri.equals("/api/media")) {
                File nvsign = getNvsignDir();
                JSONObject result = new JSONObject();
                File[] listDirs = nvsign.listFiles();
                if (listDirs != null) {
                    Arrays.sort(listDirs, (a, b) -> a.getName().compareToIgnoreCase(b.getName()));
                    for (File secDir : listDirs) {
                        if (secDir.isDirectory() && !secDir.getName().startsWith(".")) {
                            String secName = secDir.getName();
                            JSONArray fileArr = new JSONArray();
                            File[] list = secDir.listFiles();
                            if (list != null) {
                                Arrays.sort(list, (a, b) -> a.getName().compareToIgnoreCase(b.getName()));
                                for (File f : list) {
                                    if (f.isFile() && !f.getName().startsWith(".")) {
                                        JSONObject fObj = new JSONObject();
                                        fObj.put("name", f.getName());
                                        fObj.put("size", f.length());
                                        fObj.put("path", f.getAbsolutePath());
                                        fileArr.put(fObj);
                                    }
                                }
                            }
                            result.put(secName, fileArr);
                        }
                    }
                }
                return newFixedLengthResponse(Status.OK, "application/json", result.toString());
            }

            if (Method.POST.equals(method) && uri.equals("/api/create-section")) {
                Map<String, String> files = new HashMap<>();
                session.parseBody(files);
                String postData = files.get("postData");
                if (postData != null) {
                    JSONObject body = new JSONObject(postData);
                    String sectionName = body.optString("sectionName", "").trim().toLowerCase();
                    if (!sectionName.isEmpty()) {
                        sectionName = sectionName.replaceAll("[^a-zA-Z0-9_-]", "");
                        File newSecDir = new File(getNvsignDir(), sectionName);
                        if (!newSecDir.exists()) {
                            newSecDir.mkdirs();
                        }
                        emitEventToJS("media-updated", sectionName);
                        return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true}");
                    }
                }
            }

            if (Method.POST.equals(method) && uri.equals("/api/rename-section")) {
                Map<String, String> files = new HashMap<>();
                session.parseBody(files);
                String postData = files.get("postData");
                if (postData != null) {
                    JSONObject body = new JSONObject(postData);
                    String oldName = body.optString("oldName", "").trim();
                    String newName = body.optString("newName", "").trim().toLowerCase();
                    newName = newName.replaceAll("[^a-zA-Z0-9_-]", "");
                    if (!oldName.isEmpty() && !newName.isEmpty()) {
                        File oldSecDir = new File(getNvsignDir(), oldName);
                        File newSecDir = new File(getNvsignDir(), newName);
                        if (oldSecDir.exists() && oldSecDir.isDirectory()) {
                            boolean success = oldSecDir.renameTo(newSecDir);
                            if (success) {
                                emitEventToJS("media-updated", newName);
                                return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true}");
                            }
                        }
                    }
                }
                return newFixedLengthResponse(Status.BAD_REQUEST, "application/json", "{\"error\":\"Failed to rename section\"}");
            }

            if (Method.POST.equals(method) && uri.equals("/api/delete-section")) {
                Map<String, String> files = new HashMap<>();
                session.parseBody(files);
                String postData = files.get("postData");
                if (postData != null) {
                    JSONObject body = new JSONObject(postData);
                    String sectionName = body.optString("sectionName", "").trim();
                    if (!sectionName.isEmpty()) {
                        File secDir = new File(getNvsignDir(), sectionName);
                        if (secDir.exists() && secDir.isDirectory()) {
                            deleteRecursive(secDir);
                        }
                        emitEventToJS("media-updated", sectionName);
                        return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true}");
                    }
                }
            }

            if (Method.POST.equals(method) && uri.equals("/api/upload")) {
                Map<String, String> files = new HashMap<>();
                session.parseBody(files);
                Map<String, List<String>> parameters = session.getParameters();

                List<String> secList = parameters.get("section");
                String section = (secList != null && !secList.isEmpty()) ? secList.get(0) : "section1";

                File secDir = new File(getNvsignDir(), section);
                if (!secDir.exists()) {
                    secDir.mkdirs();
                }

                List<String> fileNames = parameters.get("file");
                String originalFileName = (fileNames != null && !fileNames.isEmpty()) ? fileNames.get(0) : "uploaded_media.mp4";

                originalFileName = originalFileName.replaceAll("[^a-zA-Z0-9._-]", "_");

                String tmpPath = files.get("file");
                if (tmpPath != null) {
                    File tmpFile = new File(tmpPath);
                    File destFile = new File(secDir, originalFileName);
                    
                    if (destFile.exists()) {
                        destFile.delete();
                    }

                    boolean moved = tmpFile.renameTo(destFile);
                    if (!moved) {
                        try (InputStream in = new java.io.BufferedInputStream(new FileInputStream(tmpFile), 1048576);
                             OutputStream out = new java.io.BufferedOutputStream(new FileOutputStream(destFile), 1048576)) {
                            byte[] buf = new byte[1048576];
                            int len;
                            while ((len = in.read(buf)) > 0) {
                                out.write(buf, 0, len);
                            }
                            out.flush();
                        } catch (Exception e) {
                            Log.e(TAG, "Error saving uploaded file", e);
                        }
                        try { tmpFile.delete(); } catch (Exception ignored) {}
                    }

                    emitEventToJS("media-updated", section);
                    return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true,\"file\":\"" + originalFileName + "\"}");
                }
            }

            if (Method.POST.equals(method) && uri.equals("/api/delete")) {
                Map<String, String> files = new HashMap<>();
                session.parseBody(files);
                String postData = files.get("postData");
                if (postData != null) {
                    JSONObject body = new JSONObject(postData);
                    String section = body.optString("section", "section1");
                    String fileName = body.optString("fileName", "");

                    File fileToDelete = new File(new File(getNvsignDir(), section), fileName);
                    if (fileToDelete.exists()) {
                        fileToDelete.delete();
                        emitEventToJS("media-updated", section);
                        return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true}");
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error serving HTTP request", e);
            return newFixedLengthResponse(Status.INTERNAL_ERROR, "application/json", "{\"error\":\"" + e.getMessage() + "\"}");
        }

        return newFixedLengthResponse(Status.NOT_FOUND, "text/plain", "404 Not Found");
    }

    private String getCmsHtml() {
        return "<!DOCTYPE html>\n" +
                "<html lang=\"en\">\n" +
                "<head>\n" +
                "  <meta charset=\"UTF-8\">\n" +
                "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
                "  <title>TV Ads Control Center & CMS</title>\n" +
                "  <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@600;700&family=Oswald:wght@600&family=Poppins:wght@600&display=swap\" rel=\"stylesheet\">\n" +
                "  <style>\n" +
                "    :root {\n" +
                "      --bg-primary: #0c0d12;\n" +
                "      --bg-card: #131520;\n" +
                "      --bg-input: #0d0e15;\n" +
                "      --text-main: #f8fafc;\n" +
                "      --text-muted: #94a3b8;\n" +
                "      --border: #1e293b;\n" +
                "      --accent: #6366f1;\n" +
                "      --accent-hover: #4f46e5;\n" +
                "      --ip-badge-bg: #1e293b;\n" +
                "      --upload-bg: #0d0e15;\n" +
                "    }\n" +
                "    body.light-theme {\n" +
                "      --bg-primary: #f8fafc;\n" +
                "      --bg-card: #ffffff;\n" +
                "      --bg-input: #f1f5f9;\n" +
                "      --text-main: #0f172a;\n" +
                "      --text-muted: #475569;\n" +
                "      --border: #cbd5e1;\n" +
                "      --accent: #4f46e5;\n" +
                "      --accent-hover: #4338ca;\n" +
                "      --ip-badge-bg: #e2e8f0;\n" +
                "      --upload-bg: #f8fafc;\n" +
                "    }\n" +
                "    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; transition: background-color 0.2s, color 0.2s, border-color 0.2s; }\n" +
                "    body { background-color: var(--bg-primary); color: var(--text-main); padding: 24px; min-height: 100vh; }\n" +
                "    .container { max-width: 1000px; margin: 0 auto; }\n" +
                "    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); gap: 12px; flex-wrap: wrap; }\n" +
                "    .header-right { display: flex; align-items: center; gap: 12px; }\n" +
                "    .header h1 { font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }\n" +
                "    .ip-badge { background-color: var(--ip-badge-bg); border: 1px solid var(--border); color: #38bdf8; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 8px; }\n" +
                "    .theme-toggle-btn { background-color: var(--bg-card); border: 1px solid var(--border); color: var(--text-main); font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; }\n" +
                "    .theme-toggle-btn:hover { border-color: #38bdf8; }\n" +
                "    .tabs { display: flex; gap: 12px; margin-bottom: 24px; }\n" +
                "    .tab-btn { background-color: var(--bg-card); border: 1.5px solid var(--border); color: var(--text-muted); padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }\n" +
                "    .tab-btn.active { background-color: var(--accent); border-color: var(--accent); color: #ffffff; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }\n" +
                "    .panel { display: none; background-color: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; margin-bottom: 24px; }\n" +
                "    .panel.active { display: block; }\n" +
                "    .config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; }\n" +
                "    .full-width { grid-column: 1 / -1; }\n" +
                "    .form-group { margin-bottom: 0; }\n" +
                "    .form-label { display: block; font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; }\n" +
                "    .form-input, select, textarea { width: 100%; background-color: var(--bg-input); border: 1px solid var(--border); color: var(--text-main); padding: 12px; border-radius: 8px; font-size: 14px; outline: none; transition: border 0.2s; }\n" +
                "    .form-input:focus, select:focus, textarea:focus { border-color: #38bdf8; }\n" +
                "    .color-picker-group { display: flex; gap: 10px; align-items: center; }\n" +
                "    .color-picker-swatch { width: 46px; height: 46px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; padding: 0; background: none; flex-shrink: 0; }\n" +
                "    .layout-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-top: 8px; }\n" +
                "    .layout-card { background-color: var(--bg-input); border: 2px solid var(--border); border-radius: 12px; padding: 12px; cursor: pointer; text-align: center; transition: all 0.2s; }\n" +
                "    .layout-card:hover { border-color: #38bdf8; transform: translateY(-2px); }\n" +
                "    .layout-card.active { border-color: #38bdf8; background-color: rgba(56, 189, 248, 0.12); box-shadow: 0 0 14px rgba(56, 189, 248, 0.25); }\n" +
                "    .layout-preview { width: 100%; height: 75px; background-color: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; padding: 4px; display: flex; gap: 4px; box-sizing: border-box; }\n" +
                "    .layout-preview div { background-color: rgba(99, 102, 241, 0.25); border: 1px solid #6366f1; border-radius: 4px; color: var(--text-main); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }\n" +
                "    .layout-preview.grid-auto { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }\n" +
                "    .layout-preview.stack-vert { flex-direction: column; }\n" +
                "    .layout-preview.stack-vert div { flex: 1; width: 100%; }\n" +
                "    .layout-preview.stack-horiz { flex-direction: row; }\n" +
                "    .layout-preview.stack-horiz div { flex: 1; height: 100%; }\n" +
                "    .layout-preview.top2-bot1 { flex-direction: column; gap: 4px; }\n" +
                "    .layout-preview.top2-bot1 .top-row { display: flex; gap: 4px; flex: 1; width: 100%; background: none; border: none; padding: 0; }\n" +
                "    .layout-preview.top2-bot1 .top-row div { flex: 1; height: 100%; }\n" +
                "    .layout-preview.top2-bot1 .bot-row { flex: 1; width: 100%; }\n" +
                "    .layout-preview.top1-bot2 { flex-direction: column; gap: 4px; }\n" +
                "    .layout-preview.top1-bot2 .top-row { flex: 1; width: 100%; }\n" +
                "    .layout-preview.top1-bot2 .bot-row { display: flex; gap: 4px; flex: 1; width: 100%; background: none; border: none; padding: 0; }\n" +
                "    .layout-preview.top1-bot2 .bot-row div { flex: 1; height: 100%; }\n" +
                "    .layout-title { font-size: 12px; font-weight: 700; color: var(--text-main); }\n" +
                "    .ratio-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 8px; }\n" +
                "    .ratio-card { background-color: var(--bg-input); border: 2px solid var(--border); border-radius: 10px; padding: 10px; cursor: pointer; text-align: center; transition: all 0.2s; }\n" +
                "    .ratio-card:hover { border-color: #38bdf8; transform: translateY(-2px); }\n" +
                "    .ratio-card.active { border-color: #38bdf8; background-color: rgba(56, 189, 248, 0.12); box-shadow: 0 0 12px rgba(56, 189, 248, 0.25); }\n" +
                "    .ratio-bar { display: flex; gap: 3px; height: 36px; width: 100%; margin-bottom: 6px; }\n" +
                "    .ratio-bar div { background-color: rgba(99, 102, 241, 0.3); border: 1px solid #6366f1; border-radius: 4px; color: var(--text-main); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }\n" +
                "    .ratio-title { font-size: 11px; font-weight: 700; color: var(--text-main); }\n" +
                "    .btn-primary { background-color: var(--accent); border: none; color: #ffffff; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 10px; cursor: pointer; transition: background 0.2s; width: 100%; margin-top: 10px; }\n" +
                "    .btn-primary:hover { background-color: var(--accent-hover); }\n" +
                "    .sec-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }\n" +
                "    .sec-tabs { display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; flex-wrap: wrap; }\n" +
                "    .sec-tab { background-color: var(--bg-input); border: 1px solid var(--border); color: var(--text-muted); padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }\n" +
                "    .sec-tab.active { background-color: #0284c7; border-color: #0284c7; color: #ffffff; }\n" +
                "    .btn-action { background-color: #10b981; border: none; color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }\n" +
                "    .btn-edit { background-color: #f59e0b; border: none; color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }\n" +
                "    .btn-danger { background-color: #ef4444; border: none; color: #fff; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }\n" +
                "    .upload-box { border: 2px dashed var(--border); border-radius: 12px; padding: 32px; text-align: center; background-color: var(--upload-bg); cursor: pointer; margin-bottom: 20px; transition: all 0.2s; }\n" +
                "    .upload-box:hover, .upload-box.dragover { border-color: #38bdf8; background-color: var(--bg-card); }\n" +
                "    .progress-box { background-color: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 20px; display: none; }\n" +
                "    .progress-info { display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; margin-bottom: 8px; color: var(--text-main); }\n" +
                "    .progress-track { width: 100%; height: 12px; background-color: var(--border); border-radius: 6px; overflow: hidden; margin-bottom: 8px; }\n" +
                "    .progress-fill { height: 100%; background: linear-gradient(90deg, #38bdf8, #6366f1); width: 0%; transition: width 0.15s ease-out; }\n" +
                "    .progress-sub { font-size: 12px; color: var(--text-muted); }\n" +
                "    .file-list { display: flex; flex-direction: column; gap: 10px; }\n" +
                "    .file-item { display: flex; align-items: center; justify-content: space-between; background-color: var(--bg-input); border: 1px solid var(--border); padding: 12px 16px; border-radius: 8px; }\n" +
                "    .file-info { display: flex; align-items: center; gap: 12px; }\n" +
                "    .file-name { font-size: 14px; font-weight: 600; color: var(--text-main); }\n" +
                "    .file-size { font-size: 12px; color: var(--text-muted); }\n" +
                "    .btn-del { background-color: #ef4444; border: none; color: #fff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }\n" +
                "    .alert { padding: 12px; border-radius: 8px; font-size: 14px; margin-bottom: 16px; display: none; }\n" +
                "    .alert-success { background-color: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; color: #4ade80; }\n" +
                "  </style>\n" +
                "</head>\n" +
                "<body>\n" +
                "  <div class=\"container\">\n" +
                "    <div class=\"header\">\n" +
                "      <h1>📺 TV Ads Control Center</h1>\n" +
                "      <div class=\"header-right\">\n" +
                "        <button class=\"theme-toggle-btn\" id=\"themeBtn\" onclick=\"toggleTheme()\">\n" +
                "          <span id=\"themeIcon\">☀️</span> <span id=\"themeLabel\">Light Mode</span>\n" +
                "        </button>\n" +
                "        <div class=\"ip-badge\" id=\"cmsUrl\">CMS Web Port: 9090</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "    <div class=\"tabs\">\n" +
                "      <button class=\"tab-btn active\" onclick=\"switchTab('configTab', this)\">⚙️ Player Settings</button>\n" +
                "      <button class=\"tab-btn\" onclick=\"switchTab('mediaTab', this)\">📁 Section Media Manager</button>\n" +
                "    </div>\n" +
                "    <div id=\"alertMsg\" class=\"alert alert-success\">Settings updated successfully!</div>\n" +
                "    <!-- Config Settings Panel -->\n" +
                "    <div id=\"configTab\" class=\"panel active\">\n" +
                "      <form id=\"configForm\" onsubmit=\"saveConfig(event)\">\n" +
                "        <div class=\"config-grid\">\n" +
                "          <div class=\"form-group\">\n" +
                "            <label class=\"form-label\">Screen Orientation</label>\n" +
                "            <select id=\"orientation\">\n" +
                "              <option value=\"horizontal\">Horizontal (Landscape 0°)</option>\n" +
                "              <option value=\"reverse-horizontal\">Reverse Horizontal (180°)</option>\n" +
                "              <option value=\"vertical\">Vertical (Portrait 90°)</option>\n" +
                "              <option value=\"reverse-vertical\">Reverse Vertical (-90°)</option>\n" +
                "            </select>\n" +
                "          </div>\n" +
                "          <div class=\"form-group\">\n" +
                "            <label class=\"form-label\">Slide Duration (Seconds)</label>\n" +
                "            <select id=\"slideDuration\">\n" +
                "              <option value=\"3000\">3 Seconds</option>\n" +
                "              <option value=\"5000\">5 Seconds</option>\n" +
                "              <option value=\"10000\">10 Seconds</option>\n" +
                "              <option value=\"15000\">15 Seconds</option>\n" +
                "              <option value=\"30000\">30 Seconds</option>\n" +
                "            </select>\n" +
                "          </div>\n" +
                "          <!-- Layout Options Grid -->\n" +
                "          <div class=\"full-width\">\n" +
                "            <label class=\"form-label\">Multi-Section Screen Layout Options</label>\n" +
                "            <p style=\"font-size: 12px; color: var(--text-muted); margin-bottom: 8px;\">Select how sections will be arranged on TV screen:</p>\n" +
                "            <div class=\"layout-grid\">\n" +
                "              <div class=\"layout-card active\" data-layout=\"auto\" onclick=\"selectLayoutCard('auto', this)\">\n" +
                "                <div class=\"layout-preview grid-auto\"><div>1</div><div>2</div><div>3</div><div>4</div></div>\n" +
                "                <div class=\"layout-title\">Auto / Responsive Grid</div>\n" +
                "              </div>\n" +
                "              <div class=\"layout-card\" data-layout=\"stack_vertical\" onclick=\"selectLayoutCard('stack_vertical', this)\">\n" +
                "                <div class=\"layout-preview stack-vert\"><div>1</div><div>2</div><div>3</div></div>\n" +
                "                <div class=\"layout-title\">Stack Vertical</div>\n" +
                "              </div>\n" +
                "              <div class=\"layout-card\" data-layout=\"stack_horizontal\" onclick=\"selectLayoutCard('stack_horizontal', this)\">\n" +
                "                <div class=\"layout-preview stack-horiz\"><div>1</div><div>2</div><div>3</div></div>\n" +
                "                <div class=\"layout-title\">Stack Horizontal</div>\n" +
                "              </div>\n" +
                "              <div class=\"layout-card\" data-layout=\"top2_bottom1\" onclick=\"selectLayoutCard('top2_bottom1', this)\">\n" +
                "                <div class=\"layout-preview top2-bot1\"><div class=\"top-row\"><div>1</div><div>2</div></div><div class=\"bot-row\">3</div></div>\n" +
                "                <div class=\"layout-title\">Top 2 / Bottom 1</div>\n" +
                "              </div>\n" +
                "              <div class=\"layout-card\" data-layout=\"top1_bottom2\" onclick=\"selectLayoutCard('top1_bottom2', this)\">\n" +
                "                <div class=\"layout-preview top1-bot2\"><div class=\"top-row\">1</div><div class=\"bot-row\"><div>2</div><div>3</div></div></div>\n" +
                "                <div class=\"layout-title\">Top 1 / Bottom 2</div>\n" +
                "              </div>\n" +
                "            </div>\n" +
                "            <input type=\"hidden\" id=\"layoutMode\" value=\"auto\">\n" +
                "          </div>\n" +
                "          <!-- Section Ratio Options -->\n" +
                "          <div class=\"full-width\">\n" +
                "            <label class=\"form-label\">Screen Section Ratio Proportions (5 Options)</label>\n" +
                "            <p style=\"font-size: 12px; color: var(--text-muted); margin-bottom: 8px;\">Set size proportion split ratio between sections:</p>\n" +
                "            <div class=\"ratio-grid\">\n" +
                "              <div class=\"ratio-card active\" data-ratio=\"50_50\" onclick=\"selectRatioCard('50_50', this)\">\n" +
                "                <div class=\"ratio-bar\"><div style=\"flex: 5;\">50%</div><div style=\"flex: 5;\">50%</div></div>\n" +
                "                <div class=\"ratio-title\">50 : 50 (Equal Split)</div>\n" +
                "              </div>\n" +
                "              <div class=\"ratio-card\" data-ratio=\"60_40\" onclick=\"selectRatioCard('60_40', this)\">\n" +
                "                <div class=\"ratio-bar\"><div style=\"flex: 6;\">60%</div><div style=\"flex: 4;\">40%</div></div>\n" +
                "                <div class=\"ratio-title\">60 : 40 (Primary Main)</div>\n" +
                "              </div>\n" +
                "              <div class=\"ratio-card\" data-ratio=\"70_30\" onclick=\"selectRatioCard('70_30', this)\">\n" +
                "                <div class=\"ratio-bar\"><div style=\"flex: 7;\">70%</div><div style=\"flex: 3;\">30%</div></div>\n" +
                "                <div class=\"ratio-title\">70 : 30 (Wide Main)</div>\n" +
                "              </div>\n" +
                "              <div class=\"ratio-card\" data-ratio=\"40_60\" onclick=\"selectRatioCard('40_60', this)\">\n" +
                "                <div class=\"ratio-bar\"><div style=\"flex: 4;\">40%</div><div style=\"flex: 6;\">60%</div></div>\n" +
                "                <div class=\"ratio-title\">40 : 60 (Primary Secondary)</div>\n" +
                "              </div>\n" +
                "              <div class=\"ratio-card\" data-ratio=\"30_70\" onclick=\"selectRatioCard('30_70', this)\">\n" +
                "                <div class=\"ratio-bar\"><div style=\"flex: 3;\">30%</div><div style=\"flex: 7;\">70%</div></div>\n" +
                "                <div class=\"ratio-title\">30 : 70 (Wide Secondary)</div>\n" +
                "              </div>\n" +
                "            </div>\n" +
                "            <input type=\"hidden\" id=\"sectionRatio\" value=\"50_50\">\n" +
                "          </div>\n" +
                "          <div class=\"form-group full-width\">\n" +
                "            <label class=\"form-label\">Ticker Text (News Marquee)</label>\n" +
                "            <textarea id=\"tickerText\" rows=\"2\" placeholder=\"Enter ticker news text...\"></textarea>\n" +
                "          </div>\n" +
                "          <div class=\"form-group\">\n" +
                "            <label class=\"form-label\">Ticker Text Color</label>\n" +
                "            <div class=\"color-picker-group\">\n" +
                "              <input type=\"color\" id=\"tickerTextColorPicker\" class=\"color-picker-swatch\" value=\"#FFFFFF\" oninput=\"syncColorInput('tickerTextColorPicker', 'tickerTextColor')\">\n" +
                "              <input type=\"text\" id=\"tickerTextColor\" class=\"form-input\" value=\"#FFFFFF\" placeholder=\"#FFFFFF\" oninput=\"syncColorPicker('tickerTextColor', 'tickerTextColorPicker')\">\n" +
                "            </div>\n" +
                "          </div>\n" +
                "          <div class=\"form-group\">\n" +
                "            <label class=\"form-label\">Ticker Background Color</label>\n" +
                "            <div class=\"color-picker-group\">\n" +
                "              <input type=\"color\" id=\"tickerBgColorPicker\" class=\"color-picker-swatch\" value=\"#000000\" oninput=\"syncColorInput('tickerBgColorPicker', 'tickerBgColor')\">\n" +
                "              <input type=\"text\" id=\"tickerBgColor\" class=\"form-input\" value=\"#000000\" placeholder=\"#000000 or transparent\" oninput=\"syncColorPicker('tickerBgColor', 'tickerBgColorPicker')\">\n" +
                "            </div>\n" +
                "          </div>\n" +
                "          <div class=\"form-group\">\n" +
                "            <label class=\"form-label\">Ticker Position</label>\n" +
                "            <select id=\"tickerPosition\">\n" +
                "              <option value=\"bottom\">Bottom</option>\n" +
                "              <option value=\"middle\">Middle (Center Screen)</option>\n" +
                "              <option value=\"top\">Top</option>\n" +
                "            </select>\n" +
                "          </div>\n" +
                "          <div class=\"form-group\">\n" +
                "            <label class=\"form-label\">Ticker Font Size (px)</label>\n" +
                "            <select id=\"tickerFontSize\">\n" +
                "              <option value=\"16\">Small (16px)</option>\n" +
                "              <option value=\"24\">Medium (24px)</option>\n" +
                "              <option value=\"32\">Large (32px)</option>\n" +
                "              <option value=\"40\">X-Large (40px)</option>\n" +
                "            </select>\n" +
                "          </div>\n" +
                "          <div class=\"form-group\">\n" +
                "            <label class=\"form-label\">Ticker Font Family (10 Options)</label>\n" +
                "            <select id=\"tickerFontFamily\">\n" +
                "              <option value=\"sans-serif\">Sans-Serif (Default Standard)</option>\n" +
                "              <option value=\"serif\">Serif (Classic Times/Georgia)</option>\n" +
                "              <option value=\"monospace\">Monospace (Fixed Width Code)</option>\n" +
                "              <option value=\"cursive\">Cursive (Handwriting Script)</option>\n" +
                "              <option value=\"fantasy\">Fantasy (Decorative Display)</option>\n" +
                "              <option value=\"Roboto\">Roboto (Clean Modern)</option>\n" +
                "              <option value=\"Montserrat\">Montserrat (Geometric Sans)</option>\n" +
                "              <option value=\"Oswald\">Oswald (Condensed Bold)</option>\n" +
                "              <option value=\"Poppins\">Poppins (Rounded Modern)</option>\n" +
                "              <option value=\"Impact\">Impact (Heavy Title)</option>\n" +
                "            </select>\n" +
                "          </div>\n" +
                "          <div class=\"form-group\">\n" +
                "            <label class=\"form-label\">Video Resize Mode</label>\n" +
                "            <select id=\"resizeMode\">\n" +
                "              <option value=\"stretch\">Stretch (Full Screen Fill)</option>\n" +
                "              <option value=\"contain\">Contain (Aspect Fit)</option>\n" +
                "              <option value=\"cover\">Cover (Aspect Crop)</option>\n" +
                "            </select>\n" +
                "          </div>\n" +
                "          <div class=\"form-group\">\n" +
                "            <label class=\"form-label\">Use USB Pendrive Mode</label>\n" +
                "            <select id=\"usePendrive\">\n" +
                "              <option value=\"false\">OFF (Internal Storage)</option>\n" +
                "              <option value=\"true\">ON (USB Pendrive Storage)</option>\n" +
                "            </select>\n" +
                "          </div>\n" +
                "          <div class=\"full-width\">\n" +
                "            <button type=\"submit\" class=\"btn-primary\">💾 Save Settings & Update TV</button>\n" +
                "            <div id=\"saveSuccessMsg\" style=\"display:none; margin-top:12px; padding:12px 16px; background:rgba(34,197,94,0.15); border:1px solid #22c55e; color:#4ade80; border-radius:8px; font-weight:700; text-align:center; font-size:14px;\">✅ Settings & Layout Ratio updated instantly on TV!</div>\n" +
                "          </div>\n" +
                "        </div>\n" +
                "      </form>\n" +
                "    </div>\n" +
                "    <!-- Media Manager Panel -->\n" +
                "    <div id=\"mediaTab\" class=\"panel\">\n" +
                "      <div class=\"sec-header\">\n" +
                "        <h3 style=\"font-size: 16px; font-weight: 700;\">Sections Manager</h3>\n" +
                "        <div style=\"display: flex; gap: 8px; flex-wrap: wrap;\">\n" +
                "          <button class=\"btn-action\" onclick=\"createNewSection()\">➕ Add New Section</button>\n" +
                "          <button class=\"btn-edit\" onclick=\"renameCurrentSection()\">✏️ Rename Section</button>\n" +
                "          <button class=\"btn-danger\" onclick=\"deleteCurrentSection()\">🗑️ Delete Current Section</button>\n" +
                "        </div>\n" +
                "      </div>\n" +
                "      <div class=\"sec-tabs\" id=\"secTabContainer\"></div>\n" +
                "      <div class=\"upload-box\" id=\"uploadBox\" onclick=\"document.getElementById('fileInput').click()\">\n" +
                "        <p style=\"font-size: 36px; margin-bottom: 8px;\">📤</p>\n" +
                "        <p style=\"font-size: 16px; font-weight: 700;\">Click or Drag & Drop Multiple Files to Upload</p>\n" +
                "        <p style=\"font-size: 13px; color: var(--text-muted); margin-top: 6px;\">Select or Drop 1 or more Videos & Images together!</p>\n" +
                "        <input type=\"file\" id=\"fileInput\" multiple accept=\"image/*,video/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.svg,.heic,.jfif,.mp4,.mkv,.mov,.avi,.webm,.ts\" style=\"display: none\" onchange=\"uploadFiles(this.files)\">\n" +
                "      </div>\n" +
                "      <!-- Progress Bar Container -->\n" +
                "      <div class=\"progress-box\" id=\"progressBox\">\n" +
                "        <div class=\"progress-info\">\n" +
                "          <span id=\"progressTitle\">Uploading files...</span>\n" +
                "          <span id=\"progressPercent\">0%</span>\n" +
                "        </div>\n" +
                "        <div class=\"progress-track\">\n" +
                "          <div class=\"progress-fill\" id=\"progressBar\"></div>\n" +
                "        </div>\n" +
                "        <div class=\"progress-sub\" id=\"progressSub\">0 of 0 files uploaded</div>\n" +
                "      </div>\n" +
                "      <h3 style=\"font-size: 16px; font-weight: 700; margin-bottom: 12px;\" id=\"secTitle\">Files in Section</h3>\n" +
                "      <div class=\"file-list\" id=\"fileList\">Loading files...</div>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "  <script>\n" +
                "    let currentSection = 'section1';\n" +
                "    let allMedia = {};\n" +
                "    window.onload = function() {\n" +
                "      initTheme();\n" +
                "      fetchConfig();\n" +
                "      fetchMedia();\n" +
                "      initDragAndDrop();\n" +
                "    };\n" +
                "    function initTheme() {\n" +
                "      const savedTheme = localStorage.getItem('cms_theme') || 'dark';\n" +
                "      if (savedTheme === 'light') {\n" +
                "        document.body.classList.add('light-theme');\n" +
                "        document.getElementById('themeIcon').innerText = '🌙';\n" +
                "        document.getElementById('themeLabel').innerText = 'Dark Mode';\n" +
                "      } else {\n" +
                "        document.body.classList.remove('light-theme');\n" +
                "        document.getElementById('themeIcon').innerText = '☀️';\n" +
                "        document.getElementById('themeLabel').innerText = 'Light Mode';\n" +
                "      }\n" +
                "    }\n" +
                "    function toggleTheme() {\n" +
                "      const isLight = document.body.classList.toggle('light-theme');\n" +
                "      if (isLight) {\n" +
                "        localStorage.setItem('cms_theme', 'light');\n" +
                "        document.getElementById('themeIcon').innerText = '🌙';\n" +
                "        document.getElementById('themeLabel').innerText = 'Dark Mode';\n" +
                "      } else {\n" +
                "        localStorage.setItem('cms_theme', 'dark');\n" +
                "        document.getElementById('themeIcon').innerText = '☀️';\n" +
                "        document.getElementById('themeLabel').innerText = 'Light Mode';\n" +
                "      }\n" +
                "    }\n" +
                "    function selectLayoutCard(layout, cardEl) {\n" +
                "      document.querySelectorAll('.layout-card').forEach(c => c.classList.remove('active'));\n" +
                "      cardEl.classList.add('active');\n" +
                "      document.getElementById('layoutMode').value = layout;\n" +
                "    }\n" +
                "    function selectRatioCard(ratio, cardEl) {\n" +
                "      document.querySelectorAll('.ratio-card').forEach(c => c.classList.remove('active'));\n" +
                "      cardEl.classList.add('active');\n" +
                "      document.getElementById('sectionRatio').value = ratio;\n" +
                "    }\n" +
                "    function syncColorInput(pickerId, textId) {\n" +
                "      document.getElementById(textId).value = document.getElementById(pickerId).value.toUpperCase();\n" +
                "    }\n" +
                "    function syncColorPicker(textId, pickerId) {\n" +
                "      const val = document.getElementById(textId).value.trim();\n" +
                "      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {\n" +
                "        document.getElementById(pickerId).value = val;\n" +
                "      }\n" +
                "    }\n" +
                "    function initDragAndDrop() {\n" +
                "      const dropBox = document.getElementById('uploadBox');\n" +
                "      if (!dropBox) return;\n" +
                "      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {\n" +
                "        dropBox.addEventListener(evt, preventDefaults, false);\n" +
                "        document.body.addEventListener(evt, preventDefaults, false);\n" +
                "      });\n" +
                "      ['dragenter', 'dragover'].forEach(evt => {\n" +
                "        dropBox.addEventListener(evt, () => dropBox.classList.add('dragover'), false);\n" +
                "      });\n" +
                "      ['dragleave', 'drop'].forEach(evt => {\n" +
                "        dropBox.addEventListener(evt, () => dropBox.classList.remove('dragover'), false);\n" +
                "      });\n" +
                "      dropBox.addEventListener('drop', handleDrop, false);\n" +
                "    }\n" +
                "    function preventDefaults(e) {\n" +
                "      e.preventDefault();\n" +
                "      e.stopPropagation();\n" +
                "    }\n" +
                "    function handleDrop(e) {\n" +
                "      const dt = e.dataTransfer;\n" +
                "      const files = dt ? dt.files : null;\n" +
                "      if (files && files.length > 0) {\n" +
                "        uploadFiles(files);\n" +
                "      }\n" +
                "    }\n" +
                "    function switchTab(tabId, btn) {\n" +
                "      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));\n" +
                "      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));\n" +
                "      btn.classList.add('active');\n" +
                "      document.getElementById(tabId).classList.add('active');\n" +
                "    }\n" +
                "    function selectSection(sec) {\n" +
                "      currentSection = sec;\n" +
                "      document.querySelectorAll('.sec-tab').forEach(b => {\n" +
                "        b.classList.toggle('active', b.dataset.sec === sec);\n" +
                "      });\n" +
                "      document.getElementById('secTitle').innerText = 'Files in ' + sec.toUpperCase();\n" +
                "      renderFiles();\n" +
                "    }\n" +
                "    async function fetchConfig() {\n" +
                "      const res = await fetch('/api/config');\n" +
                "      const cfg = await res.json();\n" +
                "      document.getElementById('orientation').value = cfg.orientation || 'horizontal';\n" +
                "      document.getElementById('slideDuration').value = cfg.slideDuration || 5000;\n" +
                "      document.getElementById('tickerText').value = cfg.tickerText || '';\n" +
                "      document.getElementById('tickerTextColor').value = cfg.tickerTextColor || '#FFFFFF';\n" +
                "      syncColorPicker('tickerTextColor', 'tickerTextColorPicker');\n" +
                "      document.getElementById('tickerBgColor').value = cfg.tickerBgColor || '#000000';\n" +
                "      syncColorPicker('tickerBgColor', 'tickerBgColorPicker');\n" +
                "      document.getElementById('tickerPosition').value = cfg.tickerPosition || 'bottom';\n" +
                "      document.getElementById('tickerFontSize').value = cfg.tickerFontSize || 16;\n" +
                "      document.getElementById('tickerFontFamily').value = cfg.tickerFontFamily || 'sans-serif';\n" +
                "      document.getElementById('resizeMode').value = cfg.resizeMode || 'stretch';\n" +
                "      document.getElementById('usePendrive').value = cfg.usePendrive ? 'true' : 'false';\n" +
                "      const layout = cfg.layoutMode || 'auto';\n" +
                "      document.getElementById('layoutMode').value = layout;\n" +
                "      document.querySelectorAll('.layout-card').forEach(c => {\n" +
                "        c.classList.toggle('active', c.dataset.layout === layout);\n" +
                "      });\n" +
                "      const ratio = cfg.sectionRatio || '50_50';\n" +
                "      document.getElementById('sectionRatio').value = ratio;\n" +
                "      document.querySelectorAll('.ratio-card').forEach(c => {\n" +
                "        c.classList.toggle('active', c.dataset.ratio === ratio);\n" +
                "      });\n" +
                "    }\n" +
                "    async function saveConfig(e) {\n" +
                "      e.preventDefault();\n" +
                "      const cfg = {\n" +
                "        orientation: document.getElementById('orientation').value,\n" +
                "        slideDuration: parseInt(document.getElementById('slideDuration').value, 10),\n" +
                "        tickerText: document.getElementById('tickerText').value,\n" +
                "        tickerTextColor: document.getElementById('tickerTextColor').value,\n" +
                "        tickerBgColor: document.getElementById('tickerBgColor').value,\n" +
                "        tickerPosition: document.getElementById('tickerPosition').value,\n" +
                "        tickerFontSize: parseInt(document.getElementById('tickerFontSize').value, 10),\n" +
                "        tickerFontFamily: document.getElementById('tickerFontFamily').value,\n" +
                "        resizeMode: document.getElementById('resizeMode').value,\n" +
                "        usePendrive: document.getElementById('usePendrive').value === 'true',\n" +
                "        layoutMode: document.getElementById('layoutMode').value,\n" +
                "        sectionRatio: document.getElementById('sectionRatio').value\n" +
                "      };\n" +
                "      await fetch('/api/config', {\n" +
                "        method: 'POST',\n" +
                "        body: JSON.stringify(cfg)\n" +
                "      });\n" +
                "      var msgEl = document.getElementById('saveSuccessMsg');\n" +
                "      if (msgEl) {\n" +
                "        msgEl.style.display = 'block';\n" +
                "        setTimeout(function() { msgEl.style.display = 'none'; }, 4000);\n" +
                "      }\n" +
                "      fetchConfig();\n" +
                "    }\n" +
                "    async function fetchMedia() {\n" +
                "      const res = await fetch('/api/media');\n" +
                "      allMedia = await res.json();\n" +
                "      renderSectionTabs();\n" +
                "      renderFiles();\n" +
                "    }\n" +
                "    function renderSectionTabs() {\n" +
                "      const sections = Object.keys(allMedia);\n" +
                "      if (sections.length === 0) sections.push('section1');\n" +
                "      if (!sections.includes(currentSection)) currentSection = sections[0];\n" +
                "      const tabContainer = document.getElementById('secTabContainer');\n" +
                "      tabContainer.innerHTML = sections.map(s => `\n" +
                "        <button class=\"sec-tab ${s === currentSection ? 'active' : ''}\" data-sec=\"${s}\" onclick=\"selectSection('${s}')\">${s.toUpperCase()}</button>\n" +
                "      `).join('');\n" +
                "      document.getElementById('secTitle').innerText = 'Files in ' + currentSection.toUpperCase();\n" +
                "    }\n" +
                "    function renderFiles() {\n" +
                "      const files = allMedia[currentSection] || [];\n" +
                "      const listEl = document.getElementById('fileList');\n" +
                "      if (files.length === 0) {\n" +
                "        listEl.innerHTML = '<p style=\"color: var(--text-muted); font-size: 14px;\">No files in this section.</p>';\n" +
                "        return;\n" +
                "      }\n" +
                "      listEl.innerHTML = files.map(f => `\n" +
                "        <div class=\"file-item\">\n" +
                "          <div class=\"file-info\">\n" +
                "            <span>📄</span>\n" +
                "            <div>\n" +
                "              <div class=\"file-name\">${f.name}</div>\n" +
                "              <div class=\"file-size\">${(f.size / (1024*1024)).toFixed(2)} MB</div>\n" +
                "            </div>\n" +
                "          </div>\n" +
                "          <button class=\"btn-del\" onclick=\"deleteFile('${f.name}')\">🗑️ Delete File</button>\n" +
                "        </div>\n" +
                "      `).join('');\n" +
                "    }\n" +
                "    async function createNewSection() {\n" +
                "      const name = prompt('Enter new section folder name (e.g. section5):');\n" +
                "      if (!name) return;\n" +
                "      await fetch('/api/create-section', {\n" +
                "        method: 'POST',\n" +
                "        body: JSON.stringify({ sectionName: name })\n" +
                "      });\n" +
                "      showAlert('New section created in nvsign folder!');\n" +
                "      fetchMedia();\n" +
                "    }\n" +
                "    async function renameCurrentSection() {\n" +
                "      const newName = prompt('Enter new name for section ' + currentSection.toUpperCase() + ':', currentSection);\n" +
                "      if (!newName || newName.trim() === '' || newName.trim().toLowerCase() === currentSection.toLowerCase()) return;\n" +
                "      const res = await fetch('/api/rename-section', {\n" +
                "        method: 'POST',\n" +
                "        body: JSON.stringify({ oldName: currentSection, newName: newName })\n" +
                "      });\n" +
                "      const data = await res.json();\n" +
                "      if (data.success) {\n" +
                "        currentSection = newName.trim().toLowerCase().replaceAll(/[^a-zA-Z0-9_-]/g, '');\n" +
                "        showAlert('Section renamed successfully!');\n" +
                "        fetchMedia();\n" +
                "      } else {\n" +
                "        alert('Failed to rename section: ' + (data.error || 'Unknown error'));\n" +
                "      }\n" +
                "    }\n" +
                "    async function deleteCurrentSection() {\n" +
                "      if (!confirm('Are you sure you want to delete ' + currentSection.toUpperCase() + ' and all its files?')) return;\n" +
                "      await fetch('/api/delete-section', {\n" +
                "        method: 'POST',\n" +
                "        body: JSON.stringify({ sectionName: currentSection })\n" +
                "      });\n" +
                "      showAlert('Section deleted!');\n" +
                "      fetchMedia();\n" +
                "    }\n" +
                "    function uploadFiles(fileList) {\n" +
                "      if (!fileList || fileList.length === 0) return;\n" +
                "      const files = Array.from(fileList);\n" +
                "      const totalFiles = files.length;\n" +
                "      let completedFiles = 0;\n" +
                "      let totalBytes = 0;\n" +
                "      files.forEach(f => totalBytes += f.size);\n" +
                "      let uploadedBytesPrior = 0;\n" +
                "\n" +
                "      const progressBox = document.getElementById('progressBox');\n" +
                "      const progressBar = document.getElementById('progressBar');\n" +
                "      const progressPercent = document.getElementById('progressPercent');\n" +
                "      const progressTitle = document.getElementById('progressTitle');\n" +
                "      const progressSub = document.getElementById('progressSub');\n" +
                "\n" +
                "      progressBox.style.display = 'block';\n" +
                "      progressBar.style.width = '0%';\n" +
                "      progressPercent.innerText = '0%';\n" +
                "      progressTitle.innerText = `Uploading to ${currentSection.toUpperCase()}...`;\n" +
                "      progressSub.innerText = `0 of ${totalFiles} files uploaded`;\n" +
                "\n" +
                "      function uploadNext(index) {\n" +
                "        if (index >= totalFiles) {\n" +
                "          progressBox.style.display = 'none';\n" +
                "          showAlert(`Successfully uploaded all ${totalFiles} file(s) to ${currentSection.toUpperCase()}!`);\n" +
                "          document.getElementById('fileInput').value = '';\n" +
                "          fetchMedia();\n" +
                "          return;\n" +
                "        }\n" +
                "        const file = files[index];\n" +
                "        const formData = new FormData();\n" +
                "        formData.append('section', currentSection);\n" +
                "        formData.append('file', file, file.name);\n" +
                "\n" +
                "        const xhr = new XMLHttpRequest();\n" +
                "        xhr.open('POST', '/api/upload', true);\n" +
                "\n" +
                "        xhr.upload.onprogress = function(e) {\n" +
                "          if (e.lengthComputable) {\n" +
                "            const currentTotalUploaded = uploadedBytesPrior + e.loaded;\n" +
                "            const overallPercent = Math.min(100, Math.round((currentTotalUploaded / totalBytes) * 100));\n" +
                "            progressBar.style.width = overallPercent + '%';\n" +
                "            progressPercent.innerText = overallPercent + '%';\n" +
                "            progressTitle.innerText = `Uploading (${index + 1}/${totalFiles}): ${file.name}`;\n" +
                "            progressSub.innerText = `${index} of ${totalFiles} complete (${(currentTotalUploaded / (1024*1024)).toFixed(1)} MB / ${(totalBytes / (1024*1024)).toFixed(1)} MB)`;\n" +
                "          }\n" +
                "        };\n" +
                "\n" +
                "        xhr.onload = function() {\n" +
                "          if (xhr.status === 200) {\n" +
                "            uploadedBytesPrior += file.size;\n" +
                "            completedFiles++;\n" +
                "            uploadNext(index + 1);\n" +
                "          } else {\n" +
                "            alert(`Error uploading ${file.name}: Server returned status ${xhr.status}`);\n" +
                "            progressBox.style.display = 'none';\n" +
                "            fetchMedia();\n" +
                "          }\n" +
                "        };\n" +
                "\n" +
                "        xhr.onerror = function() {\n" +
                "          alert(`Network error uploading ${file.name}. Please check connection.`);\n" +
                "          progressBox.style.display = 'none';\n" +
                "          fetchMedia();\n" +
                "        };\n" +
                "\n" +
                "        xhr.send(formData);\n" +
                "      }\n" +
                "      uploadNext(0);\n" +
                "    }\n" +
                "    async function deleteFile(fileName) {\n" +
                "      if (!confirm('Delete ' + fileName + '?')) return;\n" +
                "      await fetch('/api/delete', {\n" +
                "        method: 'POST',\n" +
                "        body: JSON.stringify({ section: currentSection, fileName: fileName })\n" +
                "      });\n" +
                "      showAlert('File deleted!');\n" +
                "      fetchMedia();\n" +
                "    }\n" +
                "    function showAlert(msg) {\n" +
                "      const alert = document.getElementById('alertMsg');\n" +
                "      alert.innerText = msg;\n" +
                "      alert.style.display = 'block';\n" +
                "      setTimeout(() => alert.style.display = 'none', 4000);\n" +
                "    }\n" +
                "  </script>\n" +
                "</body>\n" +
                "</html>";
    }
}
