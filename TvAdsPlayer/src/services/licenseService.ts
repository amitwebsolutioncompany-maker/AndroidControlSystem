import AsyncStorage from "@react-native-async-storage/async-storage";

const LICENSE_KEY_STORAGE_KEY = "license_key_v1";
const LICENSE_DEVICE_STORAGE_KEY = "license_device_id_v1";
const LICENSE_GENERATOR_BASE_URLS = [
  "https://nva-signageplayertv-licences-fmza.vercel.app",
  "https://local-signage-player-tv-admin-user.vercel.app",
];
const LICENSE_TIMEOUT_MS = 15000;
const LICENSE_VERIFY_RETRIES = 3;

function normalizeKey(value: string): string {
  return String(value || "").trim().toUpperCase();
}

function hasConfiguredGeneratorUrl() {
  return LICENSE_GENERATOR_BASE_URLS.some((url) => /^https?:\/\//i.test(String(url || "")));
}

function fetchWithTimeout(url: string, timeoutMs = LICENSE_TIMEOUT_MS): Promise<Response> {
  return Promise.race([
    fetch(url, {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    }),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("license-timeout")), timeoutMs)
    ),
  ]);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function getExpectedLicenseFromServer(deviceId: string): Promise<string | null> {
  if (!hasConfiguredGeneratorUrl()) return null;
  const endpoints = LICENSE_GENERATOR_BASE_URLS
    .map((url) => String(url || "").trim().replace(/\/+$/, ""))
    .filter((url) => /^https?:\/\//i.test(url));

  console.log('getExpectedLicenseFromServer - deviceId:', deviceId, 'endpoints:', endpoints);

  for (const baseUrl of endpoints) {
    for (let attempt = 0; attempt < LICENSE_VERIFY_RETRIES; attempt += 1) {
      try {
        const url = `${baseUrl}/api/generate?deviceId=${encodeURIComponent(deviceId)}`;
        console.log(`Attempt ${attempt + 1}: Fetching from ${url}`);
        const res = await fetchWithTimeout(
          url,
          LICENSE_TIMEOUT_MS + attempt * 4000
        );
        console.log(`Response status: ${res.status} ok: ${res.ok}`);
        if (!res.ok) continue;
        const data = await res.json();
        console.log('Response data:', data);
        const key = normalizeKey(String(data?.licenseKey || ""));
        console.log('Normalized key from server:', key);
        if (key) return key;
      } catch (e: any) {
        console.error(`Attempt ${attempt + 1} failed:`, e?.message || e);
      }
      if (attempt < LICENSE_VERIFY_RETRIES - 1) {
        await wait(1200 * (attempt + 1));
      }
    }
  }
  console.log('getExpectedLicenseFromServer: No key found from any endpoint');
  return null;
}

export async function readStoredLicense() {
  const [deviceId, licenseKey] = await Promise.all([
    AsyncStorage.getItem(LICENSE_DEVICE_STORAGE_KEY),
    AsyncStorage.getItem(LICENSE_KEY_STORAGE_KEY),
  ]);
  return {
    deviceId: String(deviceId || ""),
    licenseKey: normalizeKey(String(licenseKey || "")),
  };
}

export async function saveLicense(deviceId: string, licenseKey: string) {
  await Promise.all([
    AsyncStorage.setItem(LICENSE_DEVICE_STORAGE_KEY, String(deviceId)),
    AsyncStorage.setItem(LICENSE_KEY_STORAGE_KEY, normalizeKey(licenseKey)),
  ]);
}

export async function hasLocalActivationForDevice(deviceId: string) {
  const stored = await readStoredLicense();
  return (
    stored.deviceId === String(deviceId || "") &&
    !!stored.licenseKey &&
    stored.licenseKey.length >= 8
  );
}

export async function activateDeviceWithKey(deviceId: string, enteredKey: string) {
  const normalizedDeviceId = String(deviceId || "").trim();
  const normalizedKey = normalizeKey(enteredKey);

  console.log('activateDeviceWithKey - deviceId:', normalizedDeviceId, 'enteredKey:', normalizedKey);

  if (!normalizedDeviceId) {
    console.log('Device ID not found');
    return { success: false, message: "Device ID not found." };
  }
  if (!normalizedKey) {
    console.log('License key empty');
    return { success: false, message: "Please enter license key." };
  }
  if (!hasConfiguredGeneratorUrl()) {
    console.log('License server URL not configured');
    return {
        success: false,
        message:
          "License server URL not configured. Set LICENSE_GENERATOR_BASE_URLS in app.",
    };
  }

  try {
    console.log('Checking stored license...');
    const stored = await readStoredLicense();
    console.log('Stored license:', stored);
    if (stored.deviceId === normalizedDeviceId && stored.licenseKey === normalizedKey) {
      console.log('License matches stored, activation successful');
      return { success: true, message: "Activation successful." };
    }
    console.log('Fetching expected key from server...');
    const expectedKey = await getExpectedLicenseFromServer(normalizedDeviceId);
    console.log('Expected key from server:', expectedKey);
    if (!expectedKey) {
      console.log('No expected key from server');
      return {
        success: false,
        message: "Unable to verify key right now. Check internet/license server and retry.",
      };
    }
    if (expectedKey !== normalizedKey) {
      console.log('Key mismatch - expected:', expectedKey, 'entered:', normalizedKey);
      return { success: false, message: "Invalid license key." };
    }

    console.log('Saving license...');
    await saveLicense(normalizedDeviceId, normalizedKey);
    console.log('License saved successfully');
    return { success: true, message: "Activation successful." };
  } catch (e: any) {
    console.error('activateDeviceWithKey error:', e);
    return {
      success: false,
      message: e?.message || "Activation failed. Try again.",
    };
  }
}
