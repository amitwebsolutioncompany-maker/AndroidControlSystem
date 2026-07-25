import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  BackHandler,
  ActivityIndicator,
  StatusBar,
  AppState,
  NativeModules,
  TextInput,
  ScrollView,
  Animated,
  Easing,
  PermissionsAndroid,
  Platform,
  Alert,
  Linking,
  NativeModules as RNNativeModules,
} from 'react-native';
import RNFS from 'react-native-fs';
import Video from 'react-native-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isUsbModuleAvailable,
  getCurrentUsbState,
  subscribeUsbState,
  type UsbState,
} from './src/services/usbManagerModule';
import {
  enableKioskMode,
  disableKioskMode,
  isKioskModuleAvailable,
} from './src/services/kioskModule';
import {
  activateDeviceWithKey,
  hasLocalActivationForDevice,
  readStoredLicense,
} from './src/services/licenseService';

const { PermissionModule } = NativeModules;

// @ts-ignore
const TVEventHandler = require('react-native').TVEventHandler;

// Path to target TvAd directory in internal storage (/sdcard/TvAd)
const ADS_DIR = `${RNFS.ExternalStorageDirectoryPath}/TvAd`;

interface MediaItem {
  name: string;
  path: string;
  type: 'image' | 'video';
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.avi', '.3gp', '.webm'];
const DURATION_OPTIONS = [
  { label: '5 Sec', value: 5000 },
  { label: '10 Sec', value: 10000 },
  { label: '15 Sec', value: 15000 },
  { label: '20 Sec', value: 20000 },
];

const COLOR_OPTIONS = [
  { label: 'White', value: '#FFFFFF' },
  { label: 'Black', value: '#000000' },
  { label: 'Red', value: '#FF0000' },
  { label: 'Green', value: '#00FF00' },
  { label: 'Blue', value: '#0000FF' },
  { label: 'Yellow', value: '#FFFF00' },
  { label: 'Cyan', value: '#00FFFF' },
  { label: 'Magenta', value: '#FF00FF' },
];

const BG_COLOR_OPTIONS = [
  { label: 'Black', value: '#000000' },
  { label: 'White', value: '#FFFFFF' },
  { label: 'Red', value: '#FF0000' },
  { label: 'Green', value: '#00FF00' },
  { label: 'Blue', value: '#0000FF' },
  { label: 'Yellow', value: '#FFFF00' },
  { label: 'Gray', value: '#808080' },
  { label: 'Transparent', value: 'transparent' },
];

const TICKER_POSITIONS = [
  { label: 'Top', value: 'top' },
  { label: 'Bottom', value: 'bottom' },
];

const FONT_SIZE_OPTIONS = [
  { label: 'Small', value: 24 },
  { label: 'Medium', value: 32 },
  { label: 'Large', value: 40 },
  { label: 'X-Large', value: 50 },
  { label: 'XX-Large', value: 60 },
];

// Config interface
interface AppConfig {
  slideDuration: number;
  tickerText: string;
  tickerTextColor: string;
  tickerBgColor: string;
  tickerPosition: 'top' | 'bottom';
  tickerFontSize: number;
  usePendrive: boolean;
  resizeMode: 'contain' | 'cover' | 'stretch';
  kioskMode: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  slideDuration: 5000,
  tickerText: '',
  tickerTextColor: '#FFFFFF',
  tickerBgColor: '#000000',
  tickerPosition: 'bottom',
  tickerFontSize: 16,
  usePendrive: false,
  resizeMode: 'stretch',
  kioskMode: true,
};

export default function App() {
  const [mediaFiles, setMediaFiles] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [configOpen, setConfigOpen] = useState<boolean>(false);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [tempConfig, setTempConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [resizeMode, setResizeMode] = useState<'contain' | 'cover' | 'stretch'>('stretch');
  const [errorCount, setErrorCount] = useState<number>(0);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [focusedId, setFocusedId] = useState<string>('');
  const [showPermissionPopup, setShowPermissionPopup] = useState<boolean>(false);
  const [showUsbPopup, setShowUsbPopup] = useState<boolean>(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const tickerWidth = useRef(0);
  const [customTextColor, setCustomTextColor] = useState<string>(config.tickerTextColor);
  const [customBgColor, setCustomBgColor] = useState<string>(config.tickerBgColor);

  // License/Activation states
  const [licenseDeviceId, setLicenseDeviceId] = useState<string>('');
  const [licenseInput, setLicenseInput] = useState<string>('');
  const [licensed, setLicensed] = useState<boolean>(false);
  const [licenseBusy, setLicenseBusy] = useState<boolean>(false);
  const [licenseStatus, setLicenseStatus] = useState<string>('');
  const [licenseReady, setLicenseReady] = useState<boolean>(false);
  const [licenseInputFocused, setLicenseInputFocused] = useState<boolean>(false);
  const [licenseButtonFocused, setLicenseButtonFocused] = useState<boolean>(false);
  const [ready, setReady] = useState<boolean>(false);

  // Initialize license check
  useEffect(() => {
    let mounted = true;
    const initLicense = async () => {
      try {
        console.log('Initializing license check...');
        const deviceId = (NativeModules as any)?.DeviceIdModule?.getDeviceId?.();
        console.log('Device ID from native module:', deviceId);

        if (!deviceId) {
          console.log('Device ID not found, skipping license check');
          if (mounted) {
            setLicenseStatus('Unable to read device id.');
            setLicenseReady(true);
            setLicensed(false);
          }
          return;
        }

        setLicenseDeviceId(deviceId);

        const storedLicense = await readStoredLicense();
        console.log('Stored license:', storedLicense);
        console.log('License key length:', storedLicense.licenseKey?.length);
        console.log('License key valid:', !!storedLicense.licenseKey && storedLicense.licenseKey.length >= 8);
        
        if (storedLicense.licenseKey) {
          setLicenseInput(storedLicense.licenseKey);
        }

        const active = await hasLocalActivationForDevice(deviceId);
        console.log('Local activation check result:', active);
        console.log('Licensed state will be set to:', !!active);
        
        if (mounted) {
          setLicensed(!!active);
          if (active) {
            setReady(true); // Auto-set ready if already activated
            setLicenseStatus('Device activated. Starting player...');
          } else {
            setLicenseStatus('License required. Enter key to activate.');
          }
        }
      } catch (e: any) {
        console.error('License check error:', e);
        if (mounted) {
          setLicensed(false);
          setLicenseStatus('Unable to read device id.');
        }
      } finally {
        if (mounted) setLicenseReady(true);
      }
    };
    initLicense();
    return () => {
      mounted = false;
    };
  }, []);

  const onActivateLicense = async () => {
    if (licenseBusy) return;
    setLicenseBusy(true);
    try {
      console.log('Starting activation with deviceId:', licenseDeviceId, 'key:', licenseInput);
      const result = await activateDeviceWithKey(licenseDeviceId, licenseInput);
      console.log('Activation result:', result);
      setLicenseStatus(result.message);
      if (result.success) {
        setLicenseInput(String(licenseInput || '').trim().toUpperCase());
        setLicensed(true);
        setReady(true); // Set ready to true directly to proceed to main screen
        
        // Check overlay permission after activation
        if (Platform.OS === 'android') {
          try {
            const hasOverlay = await (NativeModules as any)?.PermissionModule?.checkOverlayPermission?.();
            console.log('Overlay permission check:', hasOverlay);
            if (!hasOverlay) {
              console.log('Overlay permission not granted, showing popup');
              setTimeout(() => {
                requestOverlayPermission();
              }, 500);
            }
          } catch (e) {
            console.error('Error checking overlay permission:', e);
          }
        }
      }
    } catch (e: any) {
      console.error('License activation error:', e);
      setLicenseStatus('Activation failed: ' + (e?.message || 'Unknown error'));
    } finally {
      setLicenseBusy(false);
    }
  };

  // Auto-set ready when licensed
  useEffect(() => {
    if (licensed && !ready) {
      setReady(true);
    }
  }, [licensed, ready]);

  // Ticker animation effect
  useEffect(() => {
    if (config.tickerText && !configOpen) {
      const animate = () => {
        Animated.timing(scrollX, {
          toValue: -tickerWidth.current,
          duration: 5000, // 5 seconds for full scroll (faster speed)
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(() => {
          scrollX.setValue(0);
          animate();
        });
      };
      animate();
    }
    return () => {
      scrollX.stopAnimation();
    };
  }, [config.tickerText, configOpen, scrollX]);

  // Permissions States
  const [hasStorage, setHasStorage] = useState<boolean>(false);
  const [permissionsLoaded, setPermissionsLoaded] = useState<boolean>(false);

  // Request overlay permission
  const requestOverlayPermission = useCallback(() => {
    if (Platform.OS !== 'android') return;
    
    // Directly open overlay permission settings
    (NativeModules as any)?.PermissionModule?.requestOverlayPermission?.();
  }, []);

  // Active resolved ads directory path (internal or USB)
  const [activeAdsDir, setActiveAdsDir] = useState<string>(ADS_DIR);

  // Load config from AsyncStorage
  const loadConfig = useCallback(async () => {
    try {
      const savedConfig = await AsyncStorage.getItem('tvads_config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
        setTempConfig(parsed);
        setResizeMode(parsed.resizeMode || 'stretch');
        setCustomTextColor(parsed.tickerTextColor || '#FFFFFF');
        setCustomBgColor(parsed.tickerBgColor || '#000000');
      }
    } catch (e) {
      console.warn('Failed to load config:', e);
    }
  }, []);

  // Save config to AsyncStorage
  const saveConfig = useCallback(async (newConfig: AppConfig) => {
    try {
      await AsyncStorage.setItem('tvads_config', JSON.stringify(newConfig));
      setConfig(newConfig);
      setTempConfig(newConfig);
      setResizeMode(newConfig.resizeMode);
      setCustomTextColor(newConfig.tickerTextColor);
      setCustomBgColor(newConfig.tickerBgColor);
      console.log('Config saved:', newConfig);
    } catch (e) {
      console.warn('Failed to save config:', e);
    }
  }, []);

  // USB Storage Ads folder auto-detection using native UsbManagerModule
  const resolveAdsDirectory = useCallback(async () => {
    console.log('=== resolveAdsDirectory START ===');
    console.log('usePendrive config value:', config.usePendrive);
    console.log('UsbModule available:', isUsbModuleAvailable());
    
    // If pendrive is enabled in config, try to find USB first
    if (config.usePendrive && isUsbModuleAvailable()) {
      console.log('>>> PENDRIVE MODE: Using native UsbManagerModule...');
      try {
        const usbState = await getCurrentUsbState();
        console.log('USB State received:', JSON.stringify(usbState));
        console.log('USB mounted:', usbState.mounted);
        console.log('USB hasPlayableMedia:', usbState.hasPlayableMedia);
        console.log('USB mountPath:', usbState.mountPath);
        console.log('USB playlistSize:', usbState.playlist?.length);
        
        if (usbState.mounted && usbState.hasPlayableMedia && usbState.mountPath) {
          const usbAdsPath = `${usbState.mountPath}/Ads`;
          console.log(`✓✓✓ SUCCESS: USB mounted with playable media at ${usbAdsPath}`);
          return usbAdsPath;
        }
        
        console.log('USB mounted but no playable media found, falling back to internal storage');
      } catch (e) {
        console.error('Error getting USB state:', e);
      }
    }

    // Default to internal storage TvAd folder
    console.log('>>> INTERNAL STORAGE MODE: Using internal storage TvAd folder');
    const internalDir = `${RNFS.ExternalStorageDirectoryPath}/TvAd`;
    const internalExists = await RNFS.exists(internalDir);
    console.log(`TvAd folder exists: ${internalExists}`);
    
    if (!internalExists) {
      console.log('Creating TvAd folder...');
      await RNFS.mkdir(internalDir);
    }
    
    console.log('=== resolveAdsDirectory END ===');
    console.log('Returning internal path:', internalDir);
    return internalDir;
  }, [config]);

  // Request storage permission
  const requestPermission = useCallback(async () => {
    if (!PermissionModule) return;
    try {
      await PermissionModule.requestStoragePermission();
      // Recheck permission after request
      setTimeout(async () => {
        const granted = await PermissionModule.checkStoragePermission();
        setHasStorage(granted);
        if (granted) {
          setShowPermissionPopup(false);
        }
      }, 1000);
    } catch (e) {
      console.warn('Failed to request storage permission:', e);
    }
  }, []);

  // Check storage permission
  const checkStoragePermission = useCallback(async () => {
    if (!PermissionModule) {
      setHasStorage(true);
      setPermissionsLoaded(true);
      return;
    }
    try {
      const storageGranted = await PermissionModule.checkStoragePermission();
      setHasStorage(storageGranted);
      
      // Auto-request permission if not granted (without showing popup for auto-boot scenarios)
      if (!storageGranted) {
        console.log('Storage permission not granted, auto-requesting...');
        await requestPermission();
      }
    } catch (e) {
      console.warn('Storage permission query failed:', e);
      // Auto-request on error as well
      await requestPermission();
    } finally {
      setPermissionsLoaded(true);
    }
  }, [requestPermission]);

  // Check permissions on mount and when app returns from settings screen
  useEffect(() => {
    checkStoragePermission();
    loadConfig();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkStoragePermission();
        loadConfig();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkStoragePermission, loadConfig]);

  // Scan and load media files
  const scanFolder = useCallback(async () => {
    console.log('=== scanFolder START ===');
    setLoading(true);
    setErrorCount(0);
    try {
      console.log('Scanning folder with usePendrive:', config.usePendrive);
      const resolvedDir = await resolveAdsDirectory();
      setActiveAdsDir(resolvedDir);
      console.log('Resolved directory:', resolvedDir);

      // Check if directory exists before reading
      const dirExists = await RNFS.exists(resolvedDir);
      console.log('Directory exists:', dirExists);
      
      if (!dirExists) {
        console.log('Directory does not exist, creating it:', resolvedDir);
        await RNFS.mkdir(resolvedDir);
      }

      console.log('Reading directory contents...');
      const files = await RNFS.readDir(resolvedDir);
      console.log('Total files found:', files.length);
      const list: MediaItem[] = [];

      files.forEach((file) => {
        if (file.isFile()) {
          const ext = '.' + file.name.split('.').pop()?.toLowerCase();
          if (IMAGE_EXTENSIONS.includes(ext)) {
            console.log(`Image file: ${file.name}`);
            list.push({
              name: file.name,
              path: file.path,
              type: 'image',
            });
          } else if (VIDEO_EXTENSIONS.includes(ext)) {
            console.log(`Video file: ${file.name}`);
            list.push({
              name: file.name,
              path: file.path,
              type: 'video',
            });
          }
        }
      });

      console.log(`Total media files: ${list.length}`);
      
      // Sort alphabetically so sorting remains consistent
      list.sort((a, b) => a.name.localeCompare(b.name));

      console.log('Found media files:', list.length);
      setMediaFiles(list);
      setCurrentIndex(0);
    } catch (err) {
      console.warn('Error reading Ads directory:', err);
      setMediaFiles([]);
    } finally {
      setLoading(false);
    }
  }, [config.usePendrive, resolveAdsDirectory]);

  // Auto USB detection - toggle pendrive config based on USB mount status
  useEffect(() => {
    if (!isUsbModuleAvailable()) return;

    const unsubscribe = subscribeUsbState((usbState) => {
      console.log('USB state changed:', JSON.stringify(usbState));
      
      // Auto-enable pendrive when USB is mounted with playable media
      if (usbState.mounted && usbState.hasPlayableMedia && !config.usePendrive) {
        console.log('USB detected - auto-enabling pendrive mode');
        setShowUsbPopup(true);
        setConfig(prev => ({ ...prev, usePendrive: true }));
        setTempConfig(prev => ({ ...prev, usePendrive: true }));
        
        // Auto-hide popup after 5 seconds
        setTimeout(() => {
          setShowUsbPopup(false);
        }, 5000);
      }
      
      // Auto-disable pendrive when USB is not mounted and auto-switch to internal storage
      if (!usbState.mounted && config.usePendrive) {
        console.log('USB removed - auto-disabling pendrive mode and switching to internal storage');
        setConfig(prev => ({ ...prev, usePendrive: false }));
        setTempConfig(prev => ({ ...prev, usePendrive: false }));
        // Automatically rescan to switch to internal storage without manual reload
        setTimeout(() => {
          scanFolder();
        }, 500);
      }
    });

    return () => unsubscribe();
  }, [config.usePendrive, scanFolder]);

  // Kiosk mode - enable/disable native kiosk mode when config changes
  useEffect(() => {
    if (!isKioskModuleAvailable()) return;

    if (config.kioskMode) {
      console.log('Enabling native kiosk mode');
      enableKioskMode();
    } else {
      console.log('Disabling native kiosk mode');
      disableKioskMode();
    }
  }, [config.kioskMode]);

  // Initial scan triggered only when storage permission is verified or config changes
  useEffect(() => {
    if (permissionsLoaded && hasStorage) {
      console.log('Triggering scan - permissions loaded and storage available');
      scanFolder();
    }
  }, [permissionsLoaded, hasStorage, scanFolder, config.usePendrive]);

  // Handle D-pad Menu, D-pad Up or OK to open config settings
  useEffect(() => {
    if (typeof TVEventHandler === 'undefined' || !TVEventHandler) {
      console.warn('TVEventHandler is not defined in this React Native core build. Falling back to focus-based Pressable triggers.');
      return;
    }
    try {
      const tvEventHandler = new TVEventHandler();
      tvEventHandler.enable(null, (_cmp: any, evt: any) => {
        console.log('TV Event:', evt);
        // Handle multiple event types for different TV remotes
        if (evt && (
          evt.eventType === 'select' ||
          evt.eventType === 'playPause' ||
          evt.eventType === 'menu' ||
          evt.eventType === 'longPressSelect' ||
          evt.eventType === 'down'
        )) {
          // OK/Menu/Down button opens config settings
          if (!configOpen) {
            setConfigOpen(true);
            setTempConfig(config); // Initialize tempConfig with current config
            setFocusedIndex(0);
          }
        }
      });

      return () => {
        tvEventHandler.disable();
      };
    } catch (e) {
      console.warn('Could not initialize TVEventHandler:', e);
    }
  }, [configOpen, config]);

  // Back button closes config menu or blocks exit in kiosk mode
  useEffect(() => {
    const backAction = () => {
      console.log('Back pressed - configOpen:', configOpen, 'kioskMode:', config.kioskMode);
      if (configOpen) {
        setConfigOpen(false);
        setTempConfig(config); // Revert to actual config on cancel
        return true; // prevent default back press
      }
      if (config.kioskMode) {
        console.log('Kiosk mode enabled - blocking back button');
        return true; // block back button in kiosk mode
      }
      return false; // exit app normally
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [configOpen, config.kioskMode, config]);

  // Play next file in queue
  const playNext = useCallback(() => {
    if (mediaFiles.length <= 1) {
      // Loop same item (reset index to reload)
      setCurrentIndex((prev) => (prev === 0 ? -1 : 0));
      setTimeout(() => setCurrentIndex(0), 100);
      return;
    }
    setCurrentIndex((prev) => (prev + 1) % mediaFiles.length);
  }, [mediaFiles]);

  // Handle image timer
  useEffect(() => {
    if (mediaFiles.length === 0 || configOpen || loading) return;

    const currentMedia = mediaFiles[currentIndex === -1 ? 0 : currentIndex];
    if (currentMedia && currentMedia.type === 'image') {
      const timer = setTimeout(() => {
        playNext();
      }, config.slideDuration);

      return () => clearTimeout(timer);
    }
  }, [currentIndex, mediaFiles, config.slideDuration, configOpen, loading, playNext]);

  // Handle media errors gracefully to prevent player stuck screen
  const handleMediaError = () => {
    console.warn('Error loading file: ' + mediaFiles[currentIndex]?.name);
    setErrorCount((prev) => prev + 1);
    
    // If consecutive errors exceed the total count, avoid fast-spinning loop
    if (errorCount < mediaFiles.length) {
      setTimeout(() => {
        playNext();
      }, 2500);
    }
  };

  const currentMedia = mediaFiles[currentIndex === -1 ? 0 : currentIndex];

  // Show license screen if not licensed
  if (!licensed && licenseReady) {
    console.log('Showing license screen, deviceId:', licenseDeviceId);
    return (
      <View style={styles.darkContainer}>
        <StatusBar hidden />
        <View style={styles.licenseCard}>
          <Text style={styles.connectTitle}>Activate Device</Text>
          <Text style={styles.licenseHint}>Share Device ID and enter license key provided by admin.</Text>

          <View style={styles.licenseRow}>
            <Text style={styles.licenseLabel}>Device ID</Text>
            <Text selectable style={styles.licenseValue}>{licenseDeviceId || 'unknown'}</Text>
          </View>

          <View style={styles.licenseRow}>
            <Text style={styles.licenseLabel}>License Key</Text>
            <TextInput
              value={licenseInput}
              onChangeText={setLicenseInput}
              onFocus={() => setLicenseInputFocused(true)}
              onBlur={() => setLicenseInputFocused(false)}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Enter key"
              placeholderTextColor="rgba(210,220,232,0.45)"
              style={[
                styles.licenseInput,
                licenseInputFocused ? styles.licenseInputFocused : null,
              ]}
              focusable
              hasTVPreferredFocus
            />
          </View>

          <Pressable
            onPress={onActivateLicense}
            onFocus={() => setLicenseButtonFocused(true)}
            onBlur={() => setLicenseButtonFocused(false)}
            disabled={licenseBusy}
            style={({ pressed }) => [
              styles.licenseBtn,
              licenseButtonFocused ? styles.licenseBtnFocused : null,
              pressed && !licenseBusy ? { opacity: 0.85 } : null,
              licenseBusy ? { opacity: 0.55 } : null,
            ]}
            focusable
          >
            <Text style={styles.licenseBtnText}>
              {licenseBusy ? 'Verifying...' : 'Save And Activate'}
            </Text>
          </Pressable>

          <Text style={styles.licenseStatus}>{licenseStatus}</Text>
        </View>
      </View>
    );
  }

  // Render USB detection popup
  if (showUsbPopup) {
    return (
      <View style={styles.darkContainer}>
        <StatusBar hidden />
        <View style={styles.wizardCard}>
          <Text style={styles.wizardEmoji}>🔌</Text>
          <Text style={styles.wizardTitle}>USB Pendrive Detected</Text>
          <Text style={styles.wizardDesc}>
            Pendrive with media files detected. Auto-enabled pendrive mode.
          </Text>

          <Pressable
            focusable
            hasTVPreferredFocus={true}
            onPress={() => setShowUsbPopup(false)}
            style={({ pressed, focused }: any) => [
              styles.btn,
              focused && styles.btnFocused,
              pressed && styles.btnPressed,
              { marginTop: 12, minWidth: 200 }
            ]}
          >
            <Text style={styles.btnText}>OK</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Render permission popup if permission is missing
  if (showPermissionPopup && !hasStorage) {
    return (
      <View style={styles.darkContainer}>
        <StatusBar hidden />
        <View style={styles.wizardCard}>
          <Text style={styles.wizardEmoji}>📁</Text>
          <Text style={styles.wizardTitle}>File Access Required</Text>
          <Text style={styles.wizardDesc}>
            Please allow access to manage all files to play advertisements from storage.
          </Text>

          <Pressable
            focusable
            hasTVPreferredFocus={true}
            onPress={requestPermission}
            style={({ pressed, focused }: any) => [
              styles.btn,
              focused && styles.btnFocused,
              pressed && styles.btnPressed,
              { marginTop: 12, minWidth: 200 }
            ]}
          >
            <Text style={styles.btnText}>Grant Permission</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.darkContainer}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.statusText}>Scanning storage for Ads...</Text>
      </View>
    );
  }

  // Render instructions screen if folder is empty or not readable
  if (mediaFiles.length === 0) {
    return (
      <View style={styles.darkContainer}>
        <StatusBar hidden />
        <View style={styles.instructionCard}>
          <Text style={styles.emojiTitle}>📺</Text>
          <Text style={styles.titleText}>TV Ads Player</Text>
          <Text style={styles.subtitleText}>No Media Files Found</Text>
          
          <View style={styles.pathBox}>
            <Text style={styles.pathLabel}>Directory to place files:</Text>
            <Text style={styles.pathText}>{activeAdsDir}</Text>
          </View>
          
          <Text style={styles.infoText}>
            Please copy images (.jpg, .png, .webp, .gif, .bmp) or videos (.mp4, .mkv, .mov, etc.) into the 'TvAd' folder in your internal main storage and try again.
          </Text>

          <Pressable
            onPress={scanFolder}
            style={({ pressed, focused }: any) => [
              styles.btn,
              focused && styles.btnFocused,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.btnText}>Reload / Scan Folder</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.viewerContainer}>
      <StatusBar hidden />
      
      {/* Fullscreen Player */}
      {currentMedia && (
        <View style={styles.mediaContainer}>
          {/* Media Player - Always takes full space */}
          <Pressable
            focusable={!configOpen}
            hasTVPreferredFocus={!configOpen}
            style={styles.mediaWrapper}
            onPress={() => {
              // Tap on media also opens config
              if (!configOpen) {
                setConfigOpen(true);
                setTempConfig(config); // Initialize tempConfig with current config
                setFocusedIndex(0);
              }
            }}
          >
            {currentMedia.type === 'video' ? (
              <Video
                source={{ uri: `file://${currentMedia.path}` }}
                style={styles.fullscreenMedia}
                resizeMode="stretch"
                repeat={mediaFiles.length === 1}
                paused={configOpen}
                onEnd={playNext}
                onError={handleMediaError}
              />
            ) : (
              <Image
                source={{ uri: `file://${currentMedia.path}` }}
                style={styles.fullscreenMedia}
                resizeMode="stretch"
                onError={handleMediaError}
              />
            )}
          </Pressable>

          {/* Top Ticker - Overlay on top of media */}
          {(() => {
            console.log('Ticker check - position:', config.tickerPosition, 'text:', config.tickerText);
            return config.tickerPosition === 'top' && config.tickerText;
          })() && (
            <View style={[styles.tickerBar, config.tickerBgColor !== 'transparent' && { backgroundColor: config.tickerBgColor }, styles.tickerBarTop]}>
              <Animated.View 
                style={[styles.tickerScrollContainer, { transform: [{ translateX: scrollX }] }]}
                onLayout={(e) => {
                  tickerWidth.current = e.nativeEvent.layout.width;
                }}
              >
                <Animated.Text
                  style={[styles.tickerText, { color: config.tickerTextColor, fontSize: config.tickerFontSize }]}
                  onLayout={(e) => {
                    tickerWidth.current = e.nativeEvent.layout.width;
                  }}
                >
                  {config.tickerText}
                </Animated.Text>
              </Animated.View>
            </View>
          )}

          {/* Bottom Ticker - Overlay on top of media */}
          {(() => {
            console.log('Bottom ticker check - position:', config.tickerPosition, 'text:', config.tickerText);
            return config.tickerPosition === 'bottom' && config.tickerText;
          })() && (
            <View style={[styles.tickerBar, config.tickerBgColor !== 'transparent' && { backgroundColor: config.tickerBgColor }, styles.tickerBarBottom]}>
              <Animated.View 
                style={[styles.tickerScrollContainer, { transform: [{ translateX: scrollX }] }]}
                onLayout={(e) => {
                  tickerWidth.current = e.nativeEvent.layout.width;
                }}
              >
                <Animated.Text
                  style={[styles.tickerText, { color: config.tickerTextColor, fontSize: config.tickerFontSize }]}
                  onLayout={(e) => {
                    tickerWidth.current = e.nativeEvent.layout.width;
                  }}
                >
                  {config.tickerText}
                </Animated.Text>
              </Animated.View>
            </View>
          )}
        </View>
      )}

      {/* Config Settings Full Screen Page */}
      {configOpen && (
        <View style={styles.configPage}>
          <Text style={styles.configPageHeader}>⚙️ Configuration Settings</Text>

          <ScrollView 
            style={styles.configPageScroll}
            keyboardShouldPersistTaps="handled"
            focusable={true}
            contentContainerStyle={styles.configPageContent}
          >
              {/* Slide Duration */}
              <View style={styles.settingSectionSingle}>
                <Text style={styles.sectionTitle}>Image Slide Duration:</Text>
                <View style={styles.singleColumn}>
                  {DURATION_OPTIONS.map((opt, idx) => (
                    <Pressable
                      key={opt.value}
                      id={`duration-${opt.value}`}
                      focusable={true}
                      hasTVPreferredFocus={idx === 0}
                      onFocus={() => setFocusedId(`duration-${opt.value}`)}
                      onBlur={() => setFocusedId('')}
                      onPress={() => {
                        setTempConfig({ ...tempConfig, slideDuration: opt.value });
                        setFocusedIndex(idx);
                      }}
                      style={({ pressed, focused }: any) => [
                        styles.choiceBtnSingle,
                        tempConfig.slideDuration === opt.value && styles.choiceActive,
                        (focused || focusedId === `duration-${opt.value}`) && styles.btnFocused,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          tempConfig.slideDuration === opt.value && styles.choiceTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Ticker Text */}
              <View style={styles.settingSectionSingle}>
                <Text style={styles.sectionTitle}>Ticker Text:</Text>
                <TextInput
                  id="ticker-text"
                  style={styles.textInput}
                  value={tempConfig.tickerText}
                  onChangeText={(text) => setTempConfig({ ...tempConfig, tickerText: text })}
                  placeholder="Enter ticker text..."
                  placeholderTextColor="#64748b"
                  multiline={false}
                  focusable={true}
                  selectTextOnFocus={true}
                  onFocus={() => setFocusedId('ticker-text')}
                  onBlur={() => setFocusedId('')}
                />
              </View>

              {/* Ticker Text Color */}
              <View style={styles.settingSectionSingle}>
                <Text style={styles.sectionTitle}>Ticker Text Color:</Text>
                <View style={styles.colorGrid}>
                  {COLOR_OPTIONS.map((color) => (
                    <Pressable
                      key={color.value}
                      id={`textcolor-${color.value}`}
                      focusable={true}
                      onFocus={() => setFocusedId(`textcolor-${color.value}`)}
                      onBlur={() => setFocusedId('')}
                      onPress={() => {
                        setTempConfig({ ...tempConfig, tickerTextColor: color.value });
                        setCustomTextColor(color.value);
                      }}
                      style={({ pressed, focused }: any) => [
                        styles.colorBtn,
                        tempConfig.tickerTextColor === color.value && styles.colorActive,
                        (focused || focusedId === `textcolor-${color.value}`) && styles.btnFocused,
                        pressed && styles.btnPressed,
                        { backgroundColor: color.value },
                      ]}
                    />
                  ))}
                </View>
                <TextInput
                  id="textcolor-hex"
                  style={styles.hexInput}
                  value={customTextColor}
                  onChangeText={(text) => {
                    setCustomTextColor(text);
                    if (/^#[0-9A-Fa-f]{6}$/.test(text)) {
                      setTempConfig({ ...tempConfig, tickerTextColor: text });
                    }
                  }}
                  placeholder="#FFFFFF"
                  placeholderTextColor="#64748b"
                  maxLength={7}
                  focusable={true}
                  selectTextOnFocus={true}
                  onFocus={() => setFocusedId('textcolor-hex')}
                  onBlur={() => setFocusedId('')}
                />
              </View>

              {/* Ticker Background Color */}
              <View style={styles.settingSectionSingle}>
                <Text style={styles.sectionTitle}>Ticker Background Color:</Text>
                <View style={styles.colorGrid}>
                  {BG_COLOR_OPTIONS.map((color) => (
                    <Pressable
                      key={color.value}
                      id={`bgcolor-${color.value}`}
                      focusable={true}
                      onFocus={() => setFocusedId(`bgcolor-${color.value}`)}
                      onBlur={() => setFocusedId('')}
                      onPress={() => {
                        setTempConfig({ ...tempConfig, tickerBgColor: color.value });
                        setCustomBgColor(color.value);
                      }}
                      style={({ pressed, focused }: any) => [
                        styles.colorBtn,
                        tempConfig.tickerBgColor === color.value && styles.colorActive,
                        (focused || focusedId === `bgcolor-${color.value}`) && styles.btnFocused,
                        pressed && styles.btnPressed,
                        { backgroundColor: color.value === 'transparent' ? '#333' : color.value },
                      ]}
                    >
                      {color.value === 'transparent' && (
                        <Text style={styles.transparentLabel}>T</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  id="bgcolor-hex"
                  style={styles.hexInput}
                  value={customBgColor}
                  onChangeText={(text) => {
                    setCustomBgColor(text);
                    if (/^#[0-9A-Fa-f]{6}$/.test(text) || text === 'transparent') {
                      setTempConfig({ ...tempConfig, tickerBgColor: text });
                    }
                  }}
                  placeholder="#000000"
                  placeholderTextColor="#64748b"
                  maxLength={11}
                  focusable={true}
                  selectTextOnFocus={true}
                  onFocus={() => setFocusedId('bgcolor-hex')}
                  onBlur={() => setFocusedId('')}
                />
              </View>

              {/* Ticker Position */}
              <View style={styles.settingSectionSingle}>
                <Text style={styles.sectionTitle}>Ticker Position:</Text>
                <View style={styles.singleColumn}>
                  {TICKER_POSITIONS.map((pos) => (
                    <Pressable
                      key={pos.value}
                      id={`position-${pos.value}`}
                      focusable={true}
                      onFocus={() => setFocusedId(`position-${pos.value}`)}
                      onBlur={() => setFocusedId('')}
                      onPress={() => setTempConfig({ ...tempConfig, tickerPosition: pos.value as 'top' | 'bottom' })}
                      style={({ pressed, focused }: any) => [
                        styles.choiceBtnSingle,
                        tempConfig.tickerPosition === pos.value && styles.choiceActive,
                        (focused || focusedId === `position-${pos.value}`) && styles.btnFocused,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          tempConfig.tickerPosition === pos.value && styles.choiceTextActive,
                        ]}
                      >
                        {pos.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Ticker Font Size */}
              <View style={styles.settingSectionSingle}>
                <Text style={styles.sectionTitle}>Ticker Font Size:</Text>
                <View style={styles.singleColumn}>
                  {FONT_SIZE_OPTIONS.map((size) => (
                    <Pressable
                      key={size.value}
                      id={`fontsize-${size.value}`}
                      focusable={true}
                      onFocus={() => setFocusedId(`fontsize-${size.value}`)}
                      onBlur={() => setFocusedId('')}
                      onPress={() => setTempConfig({ ...tempConfig, tickerFontSize: size.value })}
                      style={({ pressed, focused }: any) => [
                        styles.choiceBtnSingle,
                        tempConfig.tickerFontSize === size.value && styles.choiceActive,
                        (focused || focusedId === `fontsize-${size.value}`) && styles.btnFocused,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          tempConfig.tickerFontSize === size.value && styles.choiceTextActive,
                        ]}
                      >
                        {size.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Kiosk Mode Option */}
              <View style={styles.settingSectionSingle}>
                <Text style={styles.sectionTitle}>Kiosk Mode (Block Exit):</Text>
                <View style={styles.singleColumn}>
                  <Pressable
                    id="kiosk-on"
                    focusable={true}
                    onFocus={() => setFocusedId('kiosk-on')}
                    onBlur={() => setFocusedId('')}
                    onPress={() => setTempConfig({ ...tempConfig, kioskMode: true })}
                    style={({ pressed, focused }: any) => [
                      styles.choiceBtnSingle,
                      tempConfig.kioskMode && styles.choiceActive,
                      (focused || focusedId === 'kiosk-on') && styles.btnFocused,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        tempConfig.kioskMode && styles.choiceTextActive,
                      ]}
                    >
                      ON
                    </Text>
                  </Pressable>
                  <Pressable
                    id="kiosk-off"
                    focusable={true}
                    onFocus={() => setFocusedId('kiosk-off')}
                    onBlur={() => setFocusedId('')}
                    onPress={() => setTempConfig({ ...tempConfig, kioskMode: false })}
                    style={({ pressed, focused }: any) => [
                      styles.choiceBtnSingle,
                      !tempConfig.kioskMode && styles.choiceActive,
                      (focused || focusedId === 'kiosk-off') && styles.btnFocused,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        !tempConfig.kioskMode && styles.choiceTextActive,
                      ]}
                    >
                      OFF
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Pendrive Option */}
              <View style={styles.settingSectionSingle}>
                <Text style={styles.sectionTitle}>Use Pendrive (USB) for Ads:</Text>
                <View style={styles.singleColumn}>
                  <Pressable
                    id="pendrive-on"
                    focusable={true}
                    onFocus={() => setFocusedId('pendrive-on')}
                    onBlur={() => setFocusedId('')}
                    onPress={() => setTempConfig({ ...tempConfig, usePendrive: true })}
                    style={({ pressed, focused }: any) => [
                      styles.choiceBtnSingle,
                      tempConfig.usePendrive && styles.choiceActive,
                      (focused || focusedId === 'pendrive-on') && styles.btnFocused,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        tempConfig.usePendrive && styles.choiceTextActive,
                      ]}
                    >
                      ON
                    </Text>
                  </Pressable>
                  <Pressable
                    id="pendrive-off"
                    focusable={true}
                    onFocus={() => setFocusedId('pendrive-off')}
                    onBlur={() => setFocusedId('')}
                    onPress={() => setTempConfig({ ...tempConfig, usePendrive: false })}
                    style={({ pressed, focused }: any) => [
                      styles.choiceBtnSingle,
                      !tempConfig.usePendrive && styles.choiceActive,
                      (focused || focusedId === 'pendrive-off') && styles.btnFocused,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        !tempConfig.usePendrive && styles.choiceTextActive,
                      ]}
                    >
                      OFF
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Actions Row */}
              <View style={styles.actionRowSingle}>
                <Pressable
                  id="save-btn"
                  focusable={true}
                  onFocus={() => setFocusedId('save-btn')}
                  onBlur={() => setFocusedId('')}
                  onPress={() => {
                    saveConfig(tempConfig);
                    setConfigOpen(false);
                    scanFolder();
                  }}
                  style={({ pressed, focused }: any) => [
                    styles.btnPrimarySingle,
                    (focused || focusedId === 'save-btn') && styles.btnFocused,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text style={styles.btnText}>💾 Save & Close</Text>
                </Pressable>

                <Pressable
                  id="cancel-btn"
                  focusable={true}
                  onFocus={() => setFocusedId('cancel-btn')}
                  onBlur={() => setFocusedId('')}
                  onPress={() => {
                    setConfigOpen(false);
                    setTempConfig(config); // Revert to actual config on cancel
                  }}
                  style={({ pressed, focused }: any) => [
                    styles.btnSecondarySingle,
                    (focused || focusedId === 'cancel-btn') && styles.btnFocused,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text style={styles.btnText}>❌ Cancel</Text>
                </Pressable>
              </View>

              <Text style={styles.hintFooter}>
                Use remote D-pad to navigate. Press BACK to dismiss.
              </Text>
            </ScrollView>
          </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  darkContainer: {
    flex: 1,
    backgroundColor: '#0c0d12',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  statusText: {
    marginTop: 16,
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '500',
  },
  licenseCard: {
    width: '80%',
    backgroundColor: '#171923',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#2d3748',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  connectTitle: {
    fontSize: 24,
    color: '#f8fafc',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  licenseHint: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  licenseRow: {
    width: '100%',
    marginBottom: 16,
  },
  licenseLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  licenseValue: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: '#0d0e15',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  licenseInput: {
    backgroundColor: '#0d0e15',
    color: '#f8fafc',
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  licenseInputFocused: {
    borderColor: '#38bdf8',
  },
  licenseBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 8,
    minWidth: 200,
  },
  licenseBtnFocused: {
    backgroundColor: '#4f46e5',
  },
  licenseBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  licenseStatus: {
    marginTop: 16,
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  instructionCard: {
    width: '80%',
    backgroundColor: '#171923',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#2d3748',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  emojiTitle: {
    fontSize: 48,
    marginBottom: 8,
  },
  titleText: {
    fontSize: 24,
    color: '#f8fafc',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subtitleText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 16,
  },
  pathBox: {
    width: '100%',
    backgroundColor: '#0d0e15',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
    alignItems: 'center',
  },
  pathLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  pathText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  infoText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenMedia: {
    width: '100%',
    height: '100%',
  },
  okButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#3f3f46',
    zIndex: 20,
  },
  okButtonFocused: {
    borderColor: '#3b82f6',
    borderWidth: 4,
    transform: [{ scale: 1.05 }],
  },
  okButtonPressed: {
    opacity: 0.8,
  },
  okButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  overlayBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsDialog: {
    width: '60%',
    backgroundColor: '#131520',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#3f3f46',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  settingsHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f4f4f5',
    marginBottom: 18,
    textAlign: 'center',
  },
  settingSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#a1a1aa',
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceBtn: {
    flex: 1,
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  choiceBtnCompact: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  choiceActive: {
    backgroundColor: '#3f3f46',
    borderColor: '#6366f1',
  },
  choiceText: {
    color: '#a1a1aa',
    fontWeight: '700',
    fontSize: 12,
  },
  choiceTextActive: {
    color: '#ffffff',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 16,
  },
  btn: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3f3f46',
  },
  btnFocused: {
    borderColor: '#60a5fa',
    borderWidth: 5,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    transform: [{ scale: 1.03 }],
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  btnPressed: {
    opacity: 0.8,
  },
  mediaContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  settingsButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#3f3f46',
    zIndex: 10,
  },
  settingsButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tickerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  tickerBarTop: {
    top: 0,
  },
  tickerBarBottom: {
    bottom: 0,
    position: 'absolute',
  },
  tickerScrollContainer: {
    flexDirection: 'row',
  },
  tickerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  configDialog: {
    width: '65%',
    maxHeight: '80%',
    backgroundColor: '#131520',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#3f3f46',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  configHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f4f4f5',
    marginBottom: 18,
    textAlign: 'center',
  },
  configScroll: {
    maxHeight: 400,
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: '#27272a',
    color: '#f4f4f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 2,
    borderColor: '#3f3f46',
  },
  hexInput: {
    backgroundColor: '#27272a',
    color: '#f4f4f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 2,
    borderColor: '#3f3f46',
    marginTop: 8,
    textAlign: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorActive: {
    borderColor: '#3b82f6',
    borderWidth: 3,
  },
  transparentLabel: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  hintFooter: {
    fontSize: 10,
    color: '#71717a',
    textAlign: 'center',
    marginTop: 18,
  },
  configPage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#131520',
  },
  configPageHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f4f4f5',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 20,
  },
  configPageScroll: {
    flex: 1,
  },
  configPageContent: {
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  settingSectionSingle: {
    marginBottom: 24,
  },
  singleColumn: {
    flexDirection: 'column',
    gap: 12,
  },
  choiceBtnSingle: {
    width: '100%',
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  actionRowSingle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 16,
  },
  btnPrimarySingle: {
    flex: 1,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  btnSecondarySingle: {
    flex: 1,
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3f3f46',
  },
  wizardCard: {
    width: '85%',
    backgroundColor: '#171923',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#2d3748',
    alignItems: 'center',
  },
  wizardEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  wizardTitle: {
    fontSize: 22,
    color: '#f8fafc',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  wizardDesc: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  permRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0d0e15',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  permInfo: {
    flex: 1,
    paddingRight: 16,
  },
  permTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 3,
  },
  permText: {
    fontSize: 10,
    color: '#64748b',
    lineHeight: 14,
  },
  permBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 90,
    alignItems: 'center',
  },
  permBtnAction: {
    backgroundColor: '#6366f1',
  },
  permBtnSuccess: {
    backgroundColor: '#10b981',
  },
  permBtnInfo: {
    backgroundColor: '#3b82f6',
  },
  permBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  wizardContinueBtn: {
    width: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  wizardContinueBtnDisabled: {
    backgroundColor: '#1e293b',
    opacity: 0.5,
  },
  wizardContinueBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
