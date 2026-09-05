package com.tvadsplayer;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
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
import java.io.FileWriter;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

public class EmbeddedCmsServer extends NanoHTTPD {
    private static final String TAG = "EmbeddedCmsServer";
    public static final int DEFAULT_PORT = 9090;
    private final ReactApplicationContext reactContext;

    private String readTextFile(File file) {
        try (FileInputStream fis = new FileInputStream(file)) {
            int size = fis.available();
            byte[] buffer = new byte[size];
            fis.read(buffer);
            return new String(buffer, "UTF-8");
        } catch (Exception e) {
            return "";
        }
    }

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
            defaultConfig.put("tickerText", "Thank You for Choosing NextView • Your Trusted Digital Signage Partner • Smart Displays. Professional Solutions. Reliable Support. • +91 92278 96944");
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
            defaultConfig.put("showQrCode", true);
            defaultConfig.put("kioskMode", true);
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

    public String getSavedConfigJson() {
        return readConfigJson().toString();
    }

    public String getSavedLayoutJson() {
        File layoutFile = new File(getNvsignDir(), "custom_layout.json");
        return layoutFile.exists() ? readTextFile(layoutFile) : "{\"enabled\":false,\"zones\":[]}";
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

    private Response handleStreamingUpload(IHTTPSession session) {
        try {
            // Get content-type and extract boundary
            String contentType = session.getHeaders().get("content-type");
            String boundary = null;
            if (contentType != null && contentType.contains("boundary=")) {
                boundary = contentType.substring(contentType.indexOf("boundary=") + 9);
                if (boundary.contains(";")) {
                    boundary = boundary.substring(0, boundary.indexOf(";"));
                }
                boundary = boundary.trim();
            }
            
            if (boundary == null) {
                Log.e(TAG, "No boundary found in content-type");
                return newFixedLengthResponse(Status.BAD_REQUEST, "application/json", "{\"error\":\"No boundary found\"}");
            }

            // Get section from query parameters
            Map<String, List<String>> params = session.getParameters();
            List<String> secList = params.get("section");
            String section = (secList != null && !secList.isEmpty()) ? secList.get(0) : "section1";

            // Get filename from query parameters
            List<String> fileNameList = params.get("filename");
            String fileName = (fileNameList != null && !fileNameList.isEmpty()) ? fileNameList.get(0) : "uploaded_large_file.mkv";
            fileName = fileName.replaceAll("[^a-zA-Z0-9._-]", "_");

            File secDir = new File(getNvsignDir(), section);
            if (!secDir.exists()) {
                secDir.mkdirs();
            }

            File destFile = new File(secDir, fileName);
            if (destFile.exists()) {
                destFile.delete();
            }

            Log.d(TAG, "Starting multipart streaming upload to: " + destFile.getAbsolutePath() + ", boundary: " + boundary);

            // Parse multipart data and extract file content
            InputStream inputStream = session.getInputStream();
            byte[] boundaryBytes = ("\r\n--" + boundary).getBytes("UTF-8");
            byte[] endBoundaryBytes = ("\r\n--" + boundary + "--").getBytes("UTF-8");
            
            try (OutputStream out = new java.io.BufferedOutputStream(new FileOutputStream(destFile), 8388608)) {
                // Skip first boundary
                skipUntil(inputStream, boundaryBytes);
                skipLine(inputStream); // Skip \r\n after boundary
                
                // Skip headers until empty line
                skipHeaders(inputStream);
                
                // Now we're at the file data
                byte[] buffer = new byte[8192];
                int bytesRead;
                long totalBytes = 0;
                
                while (true) {
                    // Read chunk
                    int pos = 0;
                    while (pos < buffer.length) {
                        int b = inputStream.read();
                        if (b == -1) break;
                        
                        // Check for boundary
                        if (b == '\r' && pos > 0 && buffer[pos - 1] == '\n') {
                            // Potential boundary start
                            byte[] check = new byte[boundaryBytes.length];
                            check[0] = (byte) b;
                            int checkPos = 1;
                            while (checkPos < check.length) {
                                int cb = inputStream.read();
                                if (cb == -1) break;
                                check[checkPos++] = (byte) cb;
                            }
                            
                            if (java.util.Arrays.equals(check, boundaryBytes)) {
                                // Found boundary, end of file
                                // Check if it's the end boundary
                                byte[] nextCheck = new byte[2];
                                nextCheck[0] = (byte) inputStream.read();
                                nextCheck[1] = (byte) inputStream.read();
                                if (nextCheck[0] == '-' && nextCheck[1] == '-') {
                                    // End boundary, we're done
                                    break;
                                } else {
                                    // Not end boundary, but we should be done with file
                                    break;
                                }
                            } else {
                                // Not a boundary, write the bytes we read
                                buffer[pos++] = (byte) b;
                                for (int k = 1; k < checkPos; k++) {
                                    if (pos < buffer.length) {
                                        buffer[pos++] = check[k];
                                    } else {
                                        out.write(buffer, 0, pos);
                                        out.write(check[k]);
                                        pos = 0;
                                        totalBytes += pos;
                                    }
                                }
                            }
                        } else {
                            buffer[pos++] = (byte) b;
                        }
                    }
                    
                    if (pos > 0) {
                        out.write(buffer, 0, pos);
                        totalBytes += pos;
                        if (totalBytes % (200 * 1024 * 1024) == 0) {
                            Log.d(TAG, "Streamed " + (totalBytes / (1024 * 1024)) + " MB");
                        }
                    }
                    
                    // Check if we hit end boundary
                    if (pos == 0) break;
                }
                
                out.flush();
                Log.d(TAG, "Streaming complete: " + (totalBytes / (1024 * 1024)) + " MB written");
            }

            emitEventToJS("media-updated", section);
            return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true,\"file\":\"" + fileName + "\"}");
        } catch (Exception e) {
            Log.e(TAG, "Error in streaming upload", e);
            return newFixedLengthResponse(Status.INTERNAL_ERROR, "application/json", "{\"error\":\"Streaming upload failed: " + e.getMessage() + "\"}");
        }
    }

    private void skipUntil(InputStream in, byte[] pattern) throws Exception {
        int matchPos = 0;
        while (matchPos < pattern.length) {
            int b = in.read();
            if (b == -1) return;
            if (b == pattern[matchPos]) {
                matchPos++;
            } else {
                matchPos = 0;
            }
        }
    }

    private void skipLine(InputStream in) throws Exception {
        while (true) {
            int b = in.read();
            if (b == -1) return;
            if (b == '\n') return;
        }
    }

    private void skipHeaders(InputStream in) throws Exception {
        // Skip until empty line (\r\n\r\n)
        int prev = -1;
        while (true) {
            int b = in.read();
            if (b == -1) return;
            if (b == '\n' && prev == '\r') {
                // Check for another \r\n (end of headers)
                int next1 = in.read();
                int next2 = in.read();
                if (next1 == '\r' && next2 == '\n') {
                    return;
                } else {
                    // Not end of headers, continue
                    prev = next2;
                }
            }
            prev = b;
        }
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
                    JSONObject updates = new JSONObject(postData);
                    JSONObject newConfig = readConfigJson();
                    Iterator<String> keys = updates.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        newConfig.put(key, updates.get(key));
                    }
                    writeConfigJson(newConfig);
                    emitEventToJS("config-updated", newConfig.toString());
                    emitEventToJS("media-updated", "config-save");
                    return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true}");
                }
            }

            if (Method.POST.equals(method) && uri.equals("/api/reset-settings")) {
                File configFile = getConfigFile();
                if (configFile.exists()) configFile.delete();
                File layoutFile = new File(getNvsignDir(), "custom_layout.json");
                if (layoutFile.exists()) layoutFile.delete();
                JSONObject defaultConfig = readConfigJson();
                writeConfigJson(defaultConfig);
                emitEventToJS("config-updated", defaultConfig.toString());
                emitEventToJS("layout-updated", "{\"enabled\":false,\"zones\":[]}");
                emitEventToJS("clear-emergency", "{}");
                return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true}");
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
                                // Read _order.json if present
                                List<String> customOrder = new ArrayList<>();
                                File orderFile = new File(secDir, "_order.json");
                                if (orderFile.exists()) {
                                    try {
                                        String orderStr = readTextFile(orderFile);
                                        JSONArray orderJson = new JSONArray(orderStr);
                                        for (int i = 0; i < orderJson.length(); i++) {
                                            customOrder.add(orderJson.getString(i));
                                        }
                                    } catch (Exception ignored) {}
                                }

                                List<File> validFiles = new ArrayList<>();
                                for (File f : list) {
                                    if (f.isFile() && !f.getName().startsWith(".") && !f.getName().equalsIgnoreCase("_order.json")) {
                                        validFiles.add(f);
                                    }
                                }

                                if (!customOrder.isEmpty()) {
                                    validFiles.sort((a, b) -> {
                                        int idxA = customOrder.indexOf(a.getName());
                                        int idxB = customOrder.indexOf(b.getName());
                                        if (idxA != -1 && idxB != -1) return Integer.compare(idxA, idxB);
                                        if (idxA != -1) return -1;
                                        if (idxB != -1) return 1;
                                        return a.getName().compareToIgnoreCase(b.getName());
                                    });
                                } else {
                                    validFiles.sort((a, b) -> a.getName().compareToIgnoreCase(b.getName()));
                                }

                                for (File f : validFiles) {
                                    JSONObject fObj = new JSONObject();
                                    fObj.put("name", f.getName());
                                    fObj.put("size", f.length());
                                    fObj.put("path", f.getAbsolutePath());
                                    fileArr.put(fObj);
                                }
                            }
                            result.put(secName, fileArr);
                        }
                    }
                }
                return newFixedLengthResponse(Status.OK, "application/json", result.toString());
            }

            if (Method.POST.equals(method) && uri.equals("/api/reorder-media")) {
                Map<String, String> files = new HashMap<>();
                session.parseBody(files);
                String postData = files.get("postData");
                if (postData != null) {
                    JSONObject body = new JSONObject(postData);
                    String section = body.optString("section", "section1");
                    JSONArray fileOrder = body.optJSONArray("fileOrder");
                    if (fileOrder != null) {
                        File secDir = new File(getNvsignDir(), section);
                        if (secDir.exists() && secDir.isDirectory()) {
                            File orderFile = new File(secDir, "_order.json");
                            try (FileWriter writer = new FileWriter(orderFile)) {
                                writer.write(fileOrder.toString(2));
                            }
                            emitEventToJS("media-updated", section);
                            return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true}");
                        }
                    }
                }
                return newFixedLengthResponse(Status.BAD_REQUEST, "application/json", "{\"error\":\"Failed to save file order\"}");
            }

            if (Method.POST.equals(method) && uri.equals("/api/restart-app")) {
                try {
                    Intent launchIntent = reactContext.getPackageManager().getLaunchIntentForPackage(reactContext.getPackageName());
                    if (launchIntent != null) {
                        launchIntent.addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK |
                            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT |
                            Intent.FLAG_ACTIVITY_SINGLE_TOP |
                            Intent.FLAG_ACTIVITY_CLEAR_TOP
                        );
                        PendingIntent pendingIntent = PendingIntent.getActivity(
                            reactContext,
                            9999,
                            launchIntent,
                            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ?
                                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE :
                                PendingIntent.FLAG_UPDATE_CURRENT
                        );
                        pendingIntent.send();
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error triggering restart launch intent", e);
                }
                new Thread(() -> {
                    try { Thread.sleep(500); } catch (Exception ignored) {}
                    System.exit(0);
                }).start();
                return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true}");
            }

            if (Method.POST.equals(method) && uri.equals("/api/emergency-alert")) {
                Map<String, String> files = new HashMap<>();
                session.parseBody(files);
                String postData = files.get("postData");
                if (postData != null) {
                    emitEventToJS("emergency-alert", postData);
                    return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true}");
                }
            }

            if (Method.POST.equals(method) && uri.equals("/api/clear-emergency")) {
                emitEventToJS("clear-emergency", "{}");
                return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true}");
            }

            if (Method.POST.equals(method) && uri.equals("/api/save-layout")) {
                Map<String, String> files = new HashMap<>();
                session.parseBody(files);
                String postData = files.get("postData");
                if (postData != null) {
                    File layoutFile = new File(getNvsignDir(), "custom_layout.json");
                    try (FileWriter writer = new FileWriter(layoutFile)) {
                        writer.write(postData);
                    } catch (Exception e) {
                        Log.e(TAG, "Error saving custom layout", e);
                    }
                    emitEventToJS("layout-updated", postData);
                    return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true}");
                }
            }

            if (Method.GET.equals(method) && uri.equals("/api/get-layout")) {
                File layoutFile = new File(getNvsignDir(), "custom_layout.json");
                if (layoutFile.exists()) {
                    String layoutContent = readTextFile(layoutFile);
                    return newFixedLengthResponse(Status.OK, "application/json", layoutContent);
                }
                return newFixedLengthResponse(Status.OK, "application/json", "{\"enabled\":false,\"zones\":[]}");
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
                try {
                    // Check content length first
                    String contentLengthStr = session.getHeaders().get("content-length");
                    long contentLength = contentLengthStr != null ? Long.parseLong(contentLengthStr) : 0;
                    
                    Log.d(TAG, "Upload request received, content-length: " + (contentLength / (1024 * 1024)) + " MB");
                    
                    // For large files (>500MB), use direct streaming to avoid parseBody issues
                    if (contentLength > 500 * 1024 * 1024) {
                        Log.d(TAG, "Using direct streaming for large file");
                        return handleStreamingUpload(session);
                    }
                    
                    // For smaller files, use standard parseBody
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
                        
                        Log.d(TAG, "Processing upload: " + originalFileName + " (" + (tmpFile.length() / (1024 * 1024)) + " MB)");
                        
                        if (destFile.exists()) {
                            destFile.delete();
                        }

                        boolean moved = tmpFile.renameTo(destFile);
                        if (!moved) {
                            Log.d(TAG, "Rename failed, using copy method");
                            try (InputStream in = new java.io.BufferedInputStream(new FileInputStream(tmpFile), 4194304);
                                 OutputStream out = new java.io.BufferedOutputStream(new FileOutputStream(destFile), 4194304)) {
                                byte[] buf = new byte[4194304];
                                int len;
                                long totalBytes = 0;
                                while ((len = in.read(buf)) > 0) {
                                    out.write(buf, 0, len);
                                    totalBytes += len;
                                    if (totalBytes % (100 * 1024 * 1024) == 0) {
                                        Log.d(TAG, "Copied " + (totalBytes / (1024 * 1024)) + " MB");
                                    }
                                }
                                out.flush();
                                Log.d(TAG, "File copy complete: " + (totalBytes / (1024 * 1024)) + " MB");
                            } catch (Exception e) {
                                Log.e(TAG, "Error saving uploaded file", e);
                                return newFixedLengthResponse(Status.INTERNAL_ERROR, "application/json", "{\"error\":\"File save failed: " + e.getMessage() + "\"}");
                            }
                            try { tmpFile.delete(); } catch (Exception ignored) {}
                        }

                        emitEventToJS("media-updated", section);
                        return newFixedLengthResponse(Status.OK, "application/json", "{\"success\":true,\"file\":\"" + originalFileName + "\"}");
                    } else {
                        return newFixedLengthResponse(Status.BAD_REQUEST, "application/json", "{\"error\":\"No file data received\"}");
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error in file upload", e);
                    return newFixedLengthResponse(Status.INTERNAL_ERROR, "application/json", "{\"error\":\"Upload failed: " + e.getMessage() + "\"}");
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
                "    .canvas-container { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 16px; }\n" +
                "    .canvas-screen { flex: 2; min-width: 320px; aspect-ratio: 16/9; background: #000; border: 2px solid var(--accent); border-radius: 12px; position: relative; overflow: hidden; }\n" +
                "    .canvas-controls { flex: 1; min-width: 280px; background: var(--bg-input); border: 1px solid var(--border); padding: 16px; border-radius: 12px; }\n" +
                "    .zone-box { position: absolute; border: 2px dashed #38bdf8; background: rgba(56, 189, 248, 0.2); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold; font-size: 12px; cursor: move; user-select: none; box-sizing: border-box; }\n" +
                "    .zone-box.active { border: 2px solid #4ade80; background: rgba(74, 222, 128, 0.25); box-shadow: 0 0 10px rgba(74,222,128,0.5); }\n" +
                "    .resize-handle { position: absolute; right: -4px; bottom: -4px; width: 12px; height: 12px; background: #4ade80; border-radius: 50%; cursor: se-resize; }\n" +
                "    .emergency-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-top: 16px; }\n" +
                "    .emergency-card { background: var(--bg-input); border: 2px solid var(--border); padding: 18px; border-radius: 12px; cursor: pointer; transition: all 0.2s; }\n" +
                "    .emergency-card:hover, .emergency-card.active { border-color: #ef4444; background: rgba(239, 68, 68, 0.15); }\n" +
                "    .alert-success { background-color: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; color: #4ade80; }\n" +
                "    @media (max-width: 768px) {\n" +
                "      body { padding: 12px; }\n" +
                "      .container { max-width: 100%; }\n" +
                "      .header { flex-direction: column; align-items: flex-start; gap: 12px; }\n" +
                "      .header-right { flex-wrap: wrap; width: 100%; }\n" +
                "      .header h1 { font-size: 18px; }\n" +
                "      .ip-badge { font-size: 11px; padding: 6px 10px; }\n" +
                "      .theme-toggle-btn { font-size: 11px; padding: 6px 10px; }\n" +
                "      .tabs { flex-wrap: wrap; gap: 8px; }\n" +
                "      .tab-btn { font-size: 12px; padding: 10px 14px; flex: 1 1 calc(50% - 4px); min-width: 140px; }\n" +
                "      .panel { padding: 16px; }\n" +
                "      .config-grid { grid-template-columns: 1fr; gap: 16px; }\n" +
                "      .layout-grid { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }\n" +
                "      .ratio-grid { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }\n" +
                "      .emergency-grid { grid-template-columns: 1fr; gap: 12px; }\n" +
                "      .canvas-container { flex-direction: column; }\n" +
                "      .canvas-screen { min-width: 100%; }\n" +
                "      .canvas-controls { min-width: 100%; }\n" +
                "      .sec-header { flex-direction: column; align-items: flex-start; }\n" +
                "      .sec-tabs { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }\n" +
                "      .sec-tab { white-space: nowrap; }\n" +
                "      .btn-action, .btn-edit, .btn-danger { font-size: 12px; padding: 8px 12px; }\n" +
                "      .btn-primary { font-size: 14px; padding: 12px 20px; }\n" +
                "      .upload-box { padding: 20px; }\n" +
                "      .upload-box p:first-child { font-size: 28px; }\n" +
                "      .upload-box p:nth-child(2) { font-size: 14px; }\n" +
                "      .file-item { flex-direction: column; align-items: flex-start; gap: 8px; }\n" +
                "      .file-info { width: 100%; }\n" +
                "      .btn-del { width: 100%; }\n" +
                "      .form-label { font-size: 12px; }\n" +
                "      .form-input, select, textarea { font-size: 13px; padding: 10px; }\n" +
                "      .layout-preview { height: 60px; }\n" +
                "      .ratio-bar { height: 30px; }\n" +
                "    }\n" +
                "    @media (max-width: 480px) {\n" +
                "      body { padding: 8px; }\n" +
                "      .header h1 { font-size: 16px; }\n" +
                "      .tab-btn { font-size: 11px; padding: 8px 10px; flex: 1 1 100%; min-width: auto; }\n" +
                "      .panel { padding: 12px; }\n" +
                "      .layout-grid { grid-template-columns: 1fr 1fr; gap: 8px; }\n" +
                "      .ratio-grid { grid-template-columns: 1fr 1fr; gap: 8px; }\n" +
                "      .btn-action, .btn-edit, .btn-danger { font-size: 11px; padding: 6px 10px; }\n" +
                "      .btn-primary { font-size: 13px; padding: 10px 16px; }\n" +
                "      .upload-box { padding: 16px; }\n" +
                "      .upload-box p:first-child { font-size: 24px; }\n" +
                "      .upload-box p:nth-child(2) { font-size: 13px; }\n" +
                "      .progress-box { padding: 12px; }\n" +
                "      .layout-preview { height: 50px; }\n" +
                "      .ratio-bar { height: 26px; }\n" +
                "      .color-picker-swatch { width: 40px; height: 40px; }\n" +
                "    }\n" +
                "  </style>\n" +
                "</head>\n" +
                "<body>\n" +
                "  <div class=\"container\">\n" +
                "    <div class=\"header\">\n" +
                "      <h1>📺 NvAd Control Center</h1>\n" +
                "      <div class=\"header-right\">\n" +
                "        <button class=\"btn-action\" style=\"background:#dc2626; border:none; font-size:12px; padding:6px 12px; cursor:pointer;\" onclick=\"resetTvSettings()\">↺ Reset Settings</button>\n" +
                "        <button class=\"btn-action\" style=\"background:#ea580c; border:none; font-size:12px; padding:6px 12px; cursor:pointer;\" onclick=\"restartTvApp()\">🔄 Restart TV Player</button>\n" +
                "        <button class=\"theme-toggle-btn\" id=\"themeBtn\" onclick=\"toggleTheme()\">\n" +
                "          <span id=\"themeIcon\">☀️</span> <span id=\"themeLabel\">Light Mode</span>\n" +
                "        </button>\n" +
                "        <div class=\"ip-badge\" id=\"cmsUrl\">CMS Web Port: 9090</div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "    <div class=\"tabs\">\n" +
                "      <button class=\"tab-btn active\" onclick=\"switchTab('configTab', this)\">⚙️ Player Settings</button>\n" +
                "      <button class=\"tab-btn\" onclick=\"switchTab('mediaTab', this)\">📁 Section Media Manager</button>\n" +
                "      <button class=\"tab-btn\" onclick=\"switchTab('canvasTab', this)\">🎨 Visual Canvas Builder</button>\n" +
                "      <button class=\"tab-btn\" onclick=\"switchTab('eabsTab', this)\">🚨 Emergency Alerts (EABS)</button>\n" +
                "      <button class=\"tab-btn\" onclick=\"switchTab('widgetsTab', this)\">🌐 Live Widgets & Streams</button>\n" +
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
                "          <div class=\"form-group\">\n" +
                "            <label class=\"form-label\">Show QR Code & TV IP on Screen</label>\n" +
                "            <select id=\"showQrCode\">\n" +
                "              <option value=\"true\">SHOW (Display QR & TV IP Badge)</option>\n" +
                "              <option value=\"false\">HIDE (Hide QR Badge)</option>\n" +
                "            </select>\n" +
                "          </div>\n" +
                "          <div class=\"form-group\">\n" +
                "            <label class=\"form-label\">🔒 Kiosk Lock Mode (Prevent Sleep & Exit)</label>\n" +
                "            <select id=\"kioskMode\">\n" +
                "              <option value=\"true\">🔒 LOCKED (ON - Keep Screen Awake & Disable Exit/Back Buttons)</option>\n" +
                "              <option value=\"false\">🔓 UNLOCKED (OFF - Allow Settings & Normal Exit)</option>\n" +
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
                "    <!-- Visual Canvas Layout Builder Panel -->\n" +
                "    <div id=\"canvasTab\" class=\"panel\">\n" +
                "      <div class=\"sec-header\">\n" +
                "        <h3 style=\"font-size: 16px; font-weight: 700;\">🎨 Visual Drag & Drop Canvas Layout Builder</h3>\n" +
                "        <div style=\"display: flex; gap: 8px; flex-wrap: wrap;\">\n" +
                "          <button class=\"btn-action\" onclick=\"addCanvasZone('media')\">📹 Add Media Zone</button>\n" +
                "          <button class=\"btn-action\" style=\"background:#8b5cf6;\" onclick=\"addCanvasZone('stream')\">📺 Add Live Stream</button>\n" +
                "          <button class=\"btn-action\" style=\"background:#0284c7;\" onclick=\"addCanvasZone('weather')\">☀️ Add Weather</button>\n" +
                "          <button class=\"btn-action\" style=\"background:#d97706;\" onclick=\"addCanvasZone('clock')\">🕒 Add Clock</button>\n" +
                "        </div>\n" +
                "      </div>\n" +
                "      <div style=\"margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;\">\n" +
                "        <label style=\"font-weight:bold; font-size:14px; display:flex; align-items:center; gap:8px;\">\n" +
                "          <input type=\"checkbox\" id=\"customLayoutEnabled\" style=\"width:18px; height:18px;\"> Enable Custom Visual Canvas Layout on TV\n" +
                "        </label>\n" +
                "        <div style=\"display:flex; gap:6px;\">\n" +
                "          <button class=\"btn-action\" style=\"background:#10b981;\" onclick=\"saveCanvasLayout()\">💾 Save Visual Layout</button>\n" +
                "        </div>\n" +
                "      </div>\n" +
                "      <div class=\"canvas-container\">\n" +
                "        <div class=\"canvas-screen\" id=\"canvasScreen\"></div>\n" +
                "        <div class=\"canvas-controls\" id=\"zonePropEditor\">\n" +
                "          <h4 style=\"margin-bottom:12px; color:var(--accent);\">Selected Zone Properties</h4>\n" +
                "          <p id=\"noZoneSelected\" style=\"color:var(--text-muted); font-size:13px;\">Click on any zone box inside the 16:9 canvas mockup to edit its position, size & layer.</p>\n" +
                "          <div id=\"zoneFields\" style=\"display:none;\">\n" +
                "            <div class=\"form-group\"><label class=\"form-label\">Zone Title / Type</label><input type=\"text\" id=\"zoneName\" class=\"form-input\" onchange=\"updateSelectedZone()\"></div>\n" +
                "            <div class=\"form-group\"><label class=\"form-label\">Left Position (%)</label><input type=\"number\" id=\"zoneLeft\" class=\"form-input\" min=\"0\" max=\"100\" onchange=\"updateSelectedZone()\"></div>\n" +
                "            <div class=\"form-group\"><label class=\"form-label\">Top Position (%)</label><input type=\"number\" id=\"zoneTop\" class=\"form-input\" min=\"0\" max=\"100\" onchange=\"updateSelectedZone()\"></div>\n" +
                "            <div class=\"form-group\"><label class=\"form-label\">Width (%)</label><input type=\"number\" id=\"zoneWidth\" class=\"form-input\" min=\"5\" max=\"100\" onchange=\"updateSelectedZone()\"></div>\n" +
                "            <div class=\"form-group\"><label class=\"form-label\">Height (%)</label><input type=\"number\" id=\"zoneHeight\" class=\"form-input\" min=\"5\" max=\"100\" onchange=\"updateSelectedZone()\"></div>\n" +
                "            <div class=\"form-group\"><label class=\"form-label\">Layer Z-Index</label><input type=\"number\" id=\"zoneZIndex\" class=\"form-input\" min=\"1\" max=\"99\" onchange=\"updateSelectedZone()\"></div>\n" +
                "            <button class=\"btn-danger\" style=\"width:100%; margin-top:12px;\" onclick=\"deleteSelectedZone()\">🗑️ Delete Zone</button>\n" +
                "          </div>\n" +
                "        </div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "    <!-- Emergency Alert Broadcast System Panel -->\n" +
                "    <div id=\"eabsTab\" class=\"panel\">\n" +
                "      <div class=\"sec-header\">\n" +
                "        <h3 style=\"font-size: 16px; font-weight: 700; color: #ef4444;\">🚨 Emergency Alert Broadcast System (EABS)</h3>\n" +
                "        <button class=\"btn-action\" style=\"background:#22c55e;\" onclick=\"clearEmergencyAlert()\">✅ Clear Emergency & Resume Normal Playback</button>\n" +
                "      </div>\n" +
                "      <p style=\"font-size:13px; color:var(--text-muted); margin-bottom:16px;\">Trigger high-priority full-screen emergency alerts instantly across all TV displays connected to the network.</p>\n" +
                "      <div class=\"emergency-grid\">\n" +
                "        <div class=\"emergency-card active\" onclick=\"selectEmergencyType('FIRE', this)\">\n" +
                "          <h3 style=\"color:#ef4444;\">🔥 Fire Emergency Alert</h3>\n" +
                "          <p>Displays full-screen red flashing fire warning with audio siren alarm.</p>\n" +
                "        </div>\n" +
                "        <div class=\"emergency-card\" onclick=\"selectEmergencyType('EVACUATION', this)\">\n" +
                "          <h3 style=\"color:#f97316;\">🚨 Security Evacuation Order</h3>\n" +
                "          <p>Displays urgent evacuation instructions with siren alert.</p>\n" +
                "        </div>\n" +
                "        <div class=\"emergency-card\" onclick=\"selectEmergencyType('CUSTOM', this)\">\n" +
                "          <h3 style=\"color:#38bdf8;\">📢 Custom Priority Announcement</h3>\n" +
                "          <p>Displays custom broadcast banner text over video screen.</p>\n" +
                "        </div>\n" +
                "      </div>\n" +
                "      <div style=\"margin-top:20px; background:var(--bg-input); padding:20px; border-radius:12px; border:1px solid var(--border);\">\n" +
                "        <h4 style=\"margin-bottom:12px;\">Alert Broadcast Configuration</h4>\n" +
                "        <div class=\"form-group full-width\">\n" +
                "          <label class=\"form-label\">Emergency Announcement Text</label>\n" +
                "          <textarea id=\"emergencyMessage\" rows=\"3\" class=\"form-input\" style=\"font-weight:bold; font-size:15px; color:#ef4444;\">🔥 FIRE EMERGENCY! PLEASE EVACUATE THE BUILDING IMMEDIATELY VIA STAIRWELL EXITS!</textarea>\n" +
                "        </div>\n" +
                "        <div class=\"form-group\" style=\"margin-top:12px;\">\n" +
                "          <label class=\"form-label\">Sound Siren Alarm</label>\n" +
                "          <select id=\"emergencySound\" class=\"form-input\">\n" +
                "            <option value=\"true\">🔊 Play Loud Siren Sound on TV Speakers</option>\n" +
                "            <option value=\"false\">🔇 Silent Alert Only</option>\n" +
                "          </select>\n" +
                "        </div>\n" +
                "        <button class=\"btn-danger\" style=\"width:100%; margin-top:16px; padding:14px; font-size:16px; font-weight:bold;\" onclick=\"triggerEmergencyAlert()\">🚨 BROADCAST EMERGENCY ALERT TO ALL TV SCREENS NOW</button>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "    <!-- Live Widgets & Stream Config Panel -->\n" +
                "    <div id=\"widgetsTab\" class=\"panel\">\n" +
                "      <h3 style=\"font-size: 16px; font-weight: 700; margin-bottom:16px;\">🌐 Live Widgets & Stream Feed Configuration</h3>\n" +
                "      <div class=\"config-grid\">\n" +
                "        <div class=\"form-group\">\n" +
                "          <label class=\"form-label\">☀️ Live Weather City</label>\n" +
                "          <input type=\"text\" id=\"weatherCity\" class=\"form-input\" value=\"Delhi\" placeholder=\"e.g. Delhi, Mumbai, Dubai, New York\">\n" +
                "        </div>\n" +
                "        <div class=\"form-group\">\n" +
                "          <label class=\"form-label\">Temperature Unit</label>\n" +
                "          <select id=\"weatherUnit\" class=\"form-input\">\n" +
                "            <option value=\"celsius\">°C (Celsius)</option>\n" +
                "            <option value=\"fahrenheit\">°F (Fahrenheit)</option>\n" +
                "          </select>\n" +
                "        </div>\n" +
                "        <div class=\"form-group full-width\">\n" +
                "          <label class=\"form-label\">📺 Website, YouTube or Live Stream URL</label>\n" +
                "          <input type=\"url\" id=\"liveStreamUrl\" class=\"form-input\" value=\"\" placeholder=\"e.g. https://example.com, YouTube link, or .m3u8 stream\">\n" +
                "        </div>\n" +
                "        <div class=\"form-group\">\n" +
                "          <label class=\"form-label\">🕒 Clock Time Format</label>\n" +
                "          <select id=\"clockFormat\" class=\"form-input\">\n" +
                "            <option value=\"12h\">12-Hour (10:30 AM)</option>\n" +
                "            <option value=\"24h\">24-Hour (22:30)</option>\n" +
                "          </select>\n" +
                "        </div>\n" +
                "        <div class=\"form-group\">\n" +
                "          <label class=\"form-label\">🕋 Prayer Times Calculation Location</label>\n" +
                "          <input type=\"text\" id=\"prayerCity\" class=\"form-input\" value=\"Delhi\" placeholder=\"e.g. Delhi, Dubai, Istanbul\">\n" +
                "        </div>\n" +
                "        <div class=\"full-width\">\n" +
                "          <button class=\"btn-primary\" onclick=\"saveWidgetsConfig()\">💾 Save Live Widgets & Stream Configuration</button>\n" +
                "        </div>\n" +
                "      </div>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "  <script>\n" +
                "    let currentSection = 'section1';\n" +
                "    let canvasZones = [];\n" +
                "    let selectedZoneIndex = -1;\n" +
                "    let selectedEmergency = 'FIRE';\n" +
                "\n" +
                "    async function fetchLayout() {\n" +
                "      try {\n" +
                "        const res = await fetch('/api/get-layout');\n" +
                "        const data = await res.json();\n" +
                "        if (data && data.zones) {\n" +
                "          canvasZones = data.zones;\n" +
                "          document.getElementById('customLayoutEnabled').checked = !!data.enabled;\n" +
                "        }\n" +
                "      } catch (e) {}\n" +
                "      if (!canvasZones || canvasZones.length === 0) {\n" +
                "        canvasZones = [\n" +
                "          { id: 'zone_1', name: 'Main Media Zone', type: 'media', left: 0, top: 0, width: 70, height: 100, zIndex: 1 },\n" +
                "          { id: 'zone_2', name: 'Live Stream Zone', type: 'stream', left: 70, top: 0, width: 30, height: 50, zIndex: 1 },\n" +
                "          { id: 'zone_3', name: 'Weather & Clock', type: 'weather', left: 70, top: 50, width: 30, height: 50, zIndex: 1 }\n" +
                "        ];\n" +
                "      }\n" +
                "      renderCanvasMockup();\n" +
                "    }\n" +
                "\n" +
                "    function addCanvasZone(type) {\n" +
                "      const id = 'zone_' + (canvasZones.length + 1);\n" +
                "      const name = type.toUpperCase() + ' Zone ' + (canvasZones.length + 1);\n" +
                "      canvasZones.push({ id, name, type, left: 10, top: 10, width: 30, height: 30, zIndex: 1 });\n" +
                "      selectedZoneIndex = canvasZones.length - 1;\n" +
                "      renderCanvasMockup();\n" +
                "    }\n" +
                "\n" +
                "    let activeDragZone = null;\n" +
                "    let activeResizeZone = null;\n" +
                "    let dragStartX = 0, dragStartY = 0;\n" +
                "    let initialLeft = 0, initialTop = 0, initialWidth = 0, initialHeight = 0;\n" +
                "\n" +
                "    function startDragZone(e, idx) {\n" +
                "      if (e.target && e.target.classList && e.target.classList.contains('resize-handle')) return;\n" +
                "      e.stopPropagation();\n" +
                "      e.preventDefault();\n" +
                "      selectedZoneIndex = idx;\n" +
                "      activeDragZone = canvasZones[idx];\n" +
                "      dragStartX = e.clientX;\n" +
                "      dragStartY = e.clientY;\n" +
                "      initialLeft = activeDragZone.left;\n" +
                "      initialTop = activeDragZone.top;\n" +
                "      renderCanvasMockup();\n" +
                "    }\n" +
                "\n" +
                "    function startResizeZone(e, idx) {\n" +
                "      e.stopPropagation();\n" +
                "      e.preventDefault();\n" +
                "      selectedZoneIndex = idx;\n" +
                "      activeResizeZone = canvasZones[idx];\n" +
                "      dragStartX = e.clientX;\n" +
                "      dragStartY = e.clientY;\n" +
                "      initialWidth = activeResizeZone.width;\n" +
                "      initialHeight = activeResizeZone.height;\n" +
                "      renderCanvasMockup();\n" +
                "    }\n" +
                "\n" +
                "    window.addEventListener('mousemove', function(e) {\n" +
                "      if (!activeDragZone && !activeResizeZone) return;\n" +
                "      const screen = document.getElementById('canvasScreen');\n" +
                "      if (!screen) return;\n" +
                "      const rect = screen.getBoundingClientRect();\n" +
                "      if (!rect || rect.width === 0 || rect.height === 0) return;\n" +
                "\n" +
                "      if (activeDragZone) {\n" +
                "        const deltaX = ((e.clientX - dragStartX) / rect.width) * 100;\n" +
                "        const deltaY = ((e.clientY - dragStartY) / rect.height) * 100;\n" +
                "        let newLeft = Math.round((initialLeft + deltaX) * 10) / 10;\n" +
                "        let newTop = Math.round((initialTop + deltaY) * 10) / 10;\n" +
                "        newLeft = Math.max(0, Math.min(100 - activeDragZone.width, newLeft));\n" +
                "        newTop = Math.max(0, Math.min(100 - activeDragZone.height, newTop));\n" +
                "        activeDragZone.left = newLeft;\n" +
                "        activeDragZone.top = newTop;\n" +
                "        renderCanvasMockup();\n" +
                "      } else if (activeResizeZone) {\n" +
                "        const deltaX = ((e.clientX - dragStartX) / rect.width) * 100;\n" +
                "        const deltaY = ((e.clientY - dragStartY) / rect.height) * 100;\n" +
                "        let newW = Math.round((initialWidth + deltaX) * 10) / 10;\n" +
                "        let newH = Math.round((initialHeight + deltaY) * 10) / 10;\n" +
                "        newW = Math.max(5, Math.min(100 - activeResizeZone.left, newW));\n" +
                "        newH = Math.max(5, Math.min(100 - activeResizeZone.top, newH));\n" +
                "        activeResizeZone.width = newW;\n" +
                "        activeResizeZone.height = newH;\n" +
                "        renderCanvasMockup();\n" +
                "      }\n" +
                "    });\n" +
                "\n" +
                "    window.addEventListener('mouseup', function() {\n" +
                "      activeDragZone = null;\n" +
                "      activeResizeZone = null;\n" +
                "    });\n" +
                "\n" +
                "    function renderCanvasMockup() {\n" +
                "      const screen = document.getElementById('canvasScreen');\n" +
                "      if (!screen) return;\n" +
                "      screen.innerHTML = canvasZones.map((z, idx) => `\n" +
                "        <div class=\"zone-box ${idx === selectedZoneIndex ? 'active' : ''}\" data-idx=\"${idx}\" style=\"left:${z.left}%; top:${z.top}%; width:${z.width}%; height:${z.height}%; z-index:${z.zIndex};\" onmousedown=\"startDragZone(event, ${idx})\">\n" +
                "          ${z.name}\n" +
                "          <div class=\"resize-handle\" data-idx=\"${idx}\" title=\"Drag to resize\" onmousedown=\"startResizeZone(event, ${idx})\"></div>\n" +
                "        </div>\n" +
                "      `).join('');\n" +
                "\n" +
                "      const fields = document.getElementById('zoneFields');\n" +
                "      const noZone = document.getElementById('noZoneSelected');\n" +
                "      if (selectedZoneIndex >= 0 && selectedZoneIndex < canvasZones.length) {\n" +
                "        const z = canvasZones[selectedZoneIndex];\n" +
                "        fields.style.display = 'block';\n" +
                "        noZone.style.display = 'none';\n" +
                "        document.getElementById('zoneName').value = z.name;\n" +
                "        document.getElementById('zoneLeft').value = z.left;\n" +
                "        document.getElementById('zoneTop').value = z.top;\n" +
                "        document.getElementById('zoneWidth').value = z.width;\n" +
                "        document.getElementById('zoneHeight').value = z.height;\n" +
                "        document.getElementById('zoneZIndex').value = z.zIndex;\n" +
                "      } else {\n" +
                "        fields.style.display = 'none';\n" +
                "        noZone.style.display = 'block';\n" +
                "      }\n" +
                "    }\n" +
                "\n" +
                "    function selectCanvasZone(idx) {\n" +
                "      selectedZoneIndex = idx;\n" +
                "      renderCanvasMockup();\n" +
                "    }\n" +
                "\n" +
                "    function updateSelectedZone() {\n" +
                "      if (selectedZoneIndex < 0 || selectedZoneIndex >= canvasZones.length) return;\n" +
                "      const z = canvasZones[selectedZoneIndex];\n" +
                "      z.name = document.getElementById('zoneName').value;\n" +
                "      z.left = parseFloat(document.getElementById('zoneLeft').value) || 0;\n" +
                "      z.top = parseFloat(document.getElementById('zoneTop').value) || 0;\n" +
                "      z.width = parseFloat(document.getElementById('zoneWidth').value) || 10;\n" +
                "      z.height = parseFloat(document.getElementById('zoneHeight').value) || 10;\n" +
                "      z.zIndex = parseInt(document.getElementById('zoneZIndex').value) || 1;\n" +
                "      renderCanvasMockup();\n" +
                "    }\n" +
                "\n" +
                "    function deleteSelectedZone() {\n" +
                "      if (selectedZoneIndex < 0 || selectedZoneIndex >= canvasZones.length) {\n" +
                "        alert('Please select a zone box first by clicking on it inside the 16:9 canvas!');\n" +
                "        return;\n" +
                "      }\n" +
                "      canvasZones.splice(selectedZoneIndex, 1);\n" +
                "      selectedZoneIndex = canvasZones.length > 0 ? 0 : -1;\n" +
                "      renderCanvasMockup();\n" +
                "    }\n" +
                "\n" +
                "    async function saveCanvasLayout() {\n" +
                "      const enabled = document.getElementById('customLayoutEnabled').checked;\n" +
                "      const payload = { enabled: enabled, zones: canvasZones };\n" +
                "      await fetch('/api/save-layout', {\n" +
                "        method: 'POST',\n" +
                "        body: JSON.stringify(payload)\n" +
                "      });\n" +
                "      showAlert('Visual Canvas Layout saved to TV! TV will display custom zones.');\n" +
                "    }\n" +
                "\n" +
                "    function selectEmergencyType(type, cardEl) {\n" +
                "      selectedEmergency = type;\n" +
                "      document.querySelectorAll('.emergency-card').forEach(c => c.classList.remove('active'));\n" +
                "      if (cardEl) cardEl.classList.add('active');\n" +
                "      const msgEl = document.getElementById('emergencyMessage');\n" +
                "      if (type === 'FIRE') {\n" +
                "        msgEl.value = '🔥 FIRE EMERGENCY! PLEASE EVACUATE THE BUILDING IMMEDIATELY VIA STAIRWELL EXITS!';\n" +
                "      } else if (type === 'EVACUATION') {\n" +
                "        msgEl.value = '🚨 SECURITY EVACUATION ORDER! PROCEED CALMLY TO NEAREST EMERGENCY ASSEMBLY POINT!';\n" +
                "      } else {\n" +
                "        msgEl.value = '📢 URGENT ANNOUNCEMENT: ATTENTION ALL VISITORS AND STAFF!';\n" +
                "      }\n" +
                "    }\n" +
                "\n" +
                "    async function triggerEmergencyAlert() {\n" +
                "      const msg = document.getElementById('emergencyMessage').value;\n" +
                "      const sound = document.getElementById('emergencySound').value === 'true';\n" +
                "      const payload = { type: selectedEmergency, title: selectedEmergency + ' ALERT', message: msg, sound: sound };\n" +
                "      await fetch('/api/emergency-alert', {\n" +
                "        method: 'POST',\n" +
                "        body: JSON.stringify(payload)\n" +
                "      });\n" +
                "      showAlert('🚨 EMERGENCY ALERT BROADCASTED TO ALL TV SCREENS!');\n" +
                "    }\n" +
                "\n" +
                "    async function clearEmergencyAlert() {\n" +
                "      await fetch('/api/clear-emergency', { method: 'POST' });\n" +
                "      showAlert('✅ Emergency Alert Cleared! Normal TV playback resumed.');\n" +
                "    }\n" +
                "\n" +
                "    async function saveWidgetsConfig() {\n" +
                "      const cfg = {\n" +
                "        weatherCity: document.getElementById('weatherCity').value,\n" +
                "        weatherUnit: document.getElementById('weatherUnit').value,\n" +
                "        liveStreamUrl: document.getElementById('liveStreamUrl').value.trim(),\n" +
                "        clockFormat: document.getElementById('clockFormat').value,\n" +
                "        prayerCity: document.getElementById('prayerCity').value\n" +
                "      };\n" +
                "      await fetch('/api/config', {\n" +
                "        method: 'POST',\n" +
                "        body: JSON.stringify(cfg)\n" +
                "      });\n" +
                "      showAlert('Live Widgets & Stream configuration updated on TV!');\n" +
                "    }\n" +
                "\n" +
                "    async function restartTvApp() {\n" +
                "      if (!confirm('Are you sure you want to restart the TV Player App?')) return;\n" +
                "      showAlert('Restarting TV Player... App will reload on screen in 2 seconds.');\n" +
                "      await fetch('/api/restart-app', { method: 'POST' });\n" +
                "    }\n" +
                "    async function resetTvSettings() {\n" +
                "      if (!confirm('Reset all player settings and canvas layout? Section media files will be kept.')) return;\n" +
                "      const res = await fetch('/api/reset-settings', { method: 'POST' });\n" +
                "      if (!res.ok) { showAlert('Could not reset settings. Please try again.'); return; }\n" +
                "      await fetchConfig();\n" +
                "      await fetchLayout();\n" +
                "      showAlert('Player settings and canvas layout reset. Section media files were kept.');\n" +
                "    }\n" +
                "    window.onload = function() {\n" +
                "      initTheme();\n" +
                "      fetchConfig();\n" +
                "      fetchMedia();\n" +
                "      initDragAndDrop();\n" +
                "      initCanvasMouseEvents();\n" +
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
                "      document.getElementById('showQrCode').value = cfg.showQrCode !== false ? 'true' : 'false';\n" +
                "      document.getElementById('kioskMode').value = cfg.kioskMode !== false ? 'true' : 'false';\n" +
                "      document.getElementById('weatherCity').value = cfg.weatherCity || 'Delhi';\n" +
                "      document.getElementById('weatherUnit').value = cfg.weatherUnit || 'celsius';\n" +
                "      document.getElementById('liveStreamUrl').value = cfg.liveStreamUrl || '';\n" +
                "      document.getElementById('clockFormat').value = cfg.clockFormat || '12h';\n" +
                "      document.getElementById('prayerCity').value = cfg.prayerCity || 'Delhi';\n" +
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
                "        showQrCode: document.getElementById('showQrCode').value === 'true',\n" +
                "        kioskMode: document.getElementById('kioskMode').value === 'true',\n" +
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
                "    let draggedIndex = null;\n" +
                "    function handleDragStart(e, idx) {\n" +
                "      draggedIndex = idx;\n" +
                "      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';\n" +
                "    }\n" +
                "    function handleDragOver(e) {\n" +
                "      e.preventDefault();\n" +
                "      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';\n" +
                "    }\n" +
                "    function handleDropFile(e, targetIdx) {\n" +
                "      e.preventDefault();\n" +
                "      if (draggedIndex === null || draggedIndex === targetIdx) return;\n" +
                "      const files = allMedia[currentSection] || [];\n" +
                "      const movedItem = files.splice(draggedIndex, 1)[0];\n" +
                "      files.splice(targetIdx, 0, movedItem);\n" +
                "      draggedIndex = null;\n" +
                "      saveFileOrder(files);\n" +
                "    }\n" +
                "    function moveFileOrder(idx, direction) {\n" +
                "      const files = allMedia[currentSection] || [];\n" +
                "      const newIdx = idx + direction;\n" +
                "      if (newIdx < 0 || newIdx >= files.length) return;\n" +
                "      const movedItem = files.splice(idx, 1)[0];\n" +
                "      files.splice(newIdx, 0, movedItem);\n" +
                "      saveFileOrder(files);\n" +
                "    }\n" +
                "    async function saveFileOrder(files) {\n" +
                "      allMedia[currentSection] = files;\n" +
                "      renderFiles();\n" +
                "      const fileNames = files.map(f => f.name);\n" +
                "      await fetch('/api/reorder-media', {\n" +
                "        method: 'POST',\n" +
                "        body: JSON.stringify({ section: currentSection, fileOrder: fileNames })\n" +
                "      });\n" +
                "      showAlert('Play sequence updated! TV Player will play files in the new order.');\n" +
                "    }\n" +
                "    function renderFiles() {\n" +
                "      const files = allMedia[currentSection] || [];\n" +
                "      const listEl = document.getElementById('fileList');\n" +
                "      if (files.length === 0) {\n" +
                "        listEl.innerHTML = '<p style=\"color: var(--text-muted); font-size: 14px;\">No files in this section.</p>';\n" +
                "        return;\n" +
                "      }\n" +
                "      listEl.innerHTML = files.map((f, idx) => `\n" +
                "        <div class=\"file-item\" draggable=\"true\" data-index=\"${idx}\" ondragstart=\"handleDragStart(event, ${idx})\" ondragover=\"handleDragOver(event)\" ondrop=\"handleDropFile(event, ${idx})\" style=\"cursor:move; user-select:none;\">\n" +
                "          <div class=\"file-info\" style=\"display:flex; align-items:center;\">\n" +
                "            <span style=\"font-size:18px; margin-right:8px; color:var(--text-muted);\" title=\"Drag to reorder\">⋮⋮</span>\n" +
                "            <span style=\"font-weight:bold; color:var(--accent); font-size:12px; margin-right:8px; min-width:24px;\">#${idx + 1}</span>\n" +
                "            <span>📄</span>\n" +
                "            <div style=\"margin-left:8px;\">\n" +
                "              <div class=\"file-name\">${f.name}</div>\n" +
                "              <div class=\"file-size\">${(f.size / (1024*1024)).toFixed(2)} MB</div>\n" +
                "            </div>\n" +
                "          </div>\n" +
                "          <div style=\"display:flex; gap:6px; align-items:center;\">\n" +
                "            <button class=\"btn-action\" style=\"padding:4px 10px; font-size:13px;\" onclick=\"moveFileOrder(${idx}, -1)\" ${idx === 0 ? 'disabled style=\"opacity:0.3;\"' : ''}>⬆️</button>\n" +
                "            <button class=\"btn-action\" style=\"padding:4px 10px; font-size:13px;\" onclick=\"moveFileOrder(${idx}, 1)\" ${idx === files.length - 1 ? 'disabled style=\"opacity:0.3;\"' : ''}>⬇️</button>\n" +
                "            <button class=\"btn-del\" onclick=\"deleteFile('${f.name}')\">🗑️ Delete</button>\n" +
                "          </div>\n" +
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
