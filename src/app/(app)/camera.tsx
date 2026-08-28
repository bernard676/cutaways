import { Ionicons } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { ApiError, GENERIC_ERROR_MESSAGE } from '@/lib/ai/errors';
import { identifyImageSubject } from '@/lib/ai/identify';
import { logger } from '@/lib/logger';
import { setPendingScan } from '@/state/pending-scan';

// Vision APIs are billed per image and a full-resolution phone photo is far larger than they
// need -- cap the long edge and re-encode as JPEG before upload.
const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.6;

type Status =
  | { kind: 'live' }
  | { kind: 'working' }
  | { kind: 'error'; message: string }
  // The camera hardware wouldn't start (busy, permission race, flaky lens). Fall back to
  // "pick an existing photo", which never touches the camera.
  | { kind: 'cameraUnavailable'; message: string };

export default function CameraScreen() {
  // The React Compiler (experiments.reactCompiler) can over-memoize native components whose
  // props are callbacks; keep this screen out of it so the camera surface stays live.
  'use no memo';

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [status, setStatus] = useState<Status>({ kind: 'live' });
  const [cameraReady, setCameraReady] = useState(false);
  // Delay mounting the preview: on Expo Go the built-in QR scanner holds the back camera, and
  // it needs a beat to release after the JS app takes over -- mounting immediately races it
  // and the preview comes up black. Also drives a one-time remount on mount error.
  const [mountToken, setMountToken] = useState(0);
  const [cameraMounted, setCameraMounted] = useState(false);
  const retriedMount = useRef(false);
  const cameraRef = useRef<CameraView>(null);

  const busy = status.kind === 'working';

  useEffect(() => {
    setCameraReady(false);
    setCameraMounted(false);
    const t = setTimeout(() => setCameraMounted(true), 350);
    return () => clearTimeout(t);
  }, [mountToken, facing]);

  async function processAndIdentify(uri: string) {
    setStatus({ kind: 'working' });
    try {
      const resized = await manipulateAsync(uri, [{ resize: { width: MAX_EDGE } }], {
        compress: JPEG_QUALITY,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!resized.base64) throw new Error('Could not read the captured image');

      const subject = await identifyImageSubject(resized.base64, 'image/jpeg');
      if (!subject.label) {
        setStatus({
          kind: 'error',
          message:
            "Couldn't recognize a clear object. Get closer, fill the frame, and keep it well lit.",
        });
        return;
      }

      setPendingScan(subject.label);
      router.back();
    } catch (err) {
      logger.error('CameraScreen', 'Identification failed', err);
      setStatus({
        kind: 'error',
        message: err instanceof ApiError ? GENERIC_ERROR_MESSAGE : "Couldn't read that photo. Try again.",
      });
    }
  }

  async function capture() {
    if (busy || !cameraReady || !cameraRef.current) return;
    setStatus({ kind: 'working' });
    let uri: string;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (!photo?.uri) throw new Error('empty capture');
      uri = photo.uri;
    } catch (err) {
      logger.error('CameraScreen', 'takePictureAsync failed', err);
      setStatus({
        kind: 'cameraUnavailable',
        message: "This device's camera didn't return a photo. Pick one from your library instead.",
      });
      return;
    }
    await processAndIdentify(uri);
  }

  async function pickFromLibrary() {
    if (busy) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    await processAndIdentify(result.assets[0].uri);
  }

  // Permission state still loading.
  if (!permission) {
    return <View style={styles.blackout} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.blackout, styles.centered]}>
        <Ionicons name="camera-outline" size={40} color="#fff" />
        <ThemedText type="body" style={styles.centerText}>
          Sketch Studios needs camera access to identify objects you photograph.
        </ThemedText>
        <Pressable
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
          accessibilityRole="button"
          style={styles.primaryButton}>
          <ThemedText type="bodySemiBold" style={styles.darkText}>
            {permission.canAskAgain ? 'Allow camera access' : 'Open Settings to enable it'}
          </ThemedText>
        </Pressable>
        <Pressable onPress={pickFromLibrary} accessibilityRole="button" hitSlop={8}>
          <ThemedText type="small" style={styles.dimText}>
            Choose a photo from your library instead
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
          <ThemedText type="small" style={styles.dimText}>
            Go back
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Camera hardware failed -- offer the library path, which doesn't touch the camera.
  if (status.kind === 'cameraUnavailable') {
    return (
      <SafeAreaView style={[styles.blackout, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={40} color="#fff" />
        <ThemedText type="body" style={styles.centerText}>
          {status.message}
        </ThemedText>
        <Pressable onPress={pickFromLibrary} accessibilityRole="button" style={styles.primaryButton}>
          <ThemedText type="bodySemiBold" style={styles.darkText}>
            Choose a photo
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => {
            retriedMount.current = false;
            setStatus({ kind: 'live' });
            setMountToken((n) => n + 1);
          }}
          accessibilityRole="button"
          hitSlop={8}>
          <ThemedText type="small" style={styles.dimText}>
            Try the camera again
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.blackout}>
      {cameraMounted ? (
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          animateShutter={false}
          onCameraReady={() => setCameraReady(true)}
          onMountError={(e) => {
            logger.error('CameraScreen', 'Camera failed to start', e);
            if (!retriedMount.current) {
              // Camera contention (e.g. Expo Go's scanner) usually clears within a second --
              // unmount and try once more before giving up.
              retriedMount.current = true;
              setCameraMounted(false);
              setTimeout(() => setMountToken((n) => n + 1), 700);
              return;
            }
            setStatus({
              kind: 'cameraUnavailable',
              message: "This device's camera couldn't start. Pick a photo from your library instead.",
            });
          }}
        />
      ) : (
        <View style={styles.camera} />
      )}

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
            hitSlop={8}
            style={styles.iconButton}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>

        {status.kind === 'error' ? (
          <View style={styles.errorCard}>
            <ThemedText type="small" style={styles.centerText}>
              {status.message}
            </ThemedText>
            <Pressable
              onPress={() => setStatus({ kind: 'live' })}
              accessibilityRole="button"
              style={styles.retakeButton}>
              <ThemedText type="bodySemiBold" style={styles.darkText}>
                Try again
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.hintWrap} pointerEvents="none">
            <ThemedText type="small" style={styles.hint}>
              Point at an object, structure, or mechanism
            </ThemedText>
          </View>
        )}

        <View style={styles.controls}>
          <Pressable
            onPress={pickFromLibrary}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Choose a photo from your library"
            hitSlop={8}
            style={styles.iconButton}>
            <Ionicons name="images-outline" size={24} color="#fff" />
          </Pressable>

          <Pressable
            onPress={capture}
            disabled={busy || !cameraReady || status.kind === 'error'}
            accessibilityRole="button"
            accessibilityLabel="Identify what's in view"
            style={[
              styles.shutter,
              (busy || !cameraReady || status.kind === 'error') && styles.shutterDisabled,
            ]}>
            {busy ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
          </Pressable>

          <Pressable
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            disabled={busy || !cameraReady || status.kind === 'error'}
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
            hitSlop={8}
            style={styles.iconButton}>
            <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
          </Pressable>
        </View>

        {busy && (
          <View style={styles.workingBanner} pointerEvents="none">
            <ActivityIndicator color="#fff" />
            <ThemedText type="mono" style={styles.workingText}>
              IDENTIFYING…
            </ThemedText>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  blackout: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: Spacing.four, padding: Spacing.six },
  centerText: { color: '#fff', textAlign: 'center' },
  darkText: { color: '#000' },
  dimText: { color: 'rgba(255,255,255,0.6)' },
  primaryButton: {
    backgroundColor: '#fff',
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.full,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  hintWrap: { alignItems: 'center' },
  hint: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radii.full,
    overflow: 'hidden',
  },
  errorCard: {
    marginHorizontal: Spacing.four,
    padding: Spacing.four,
    borderRadius: Radii.md,
    backgroundColor: 'rgba(0,0,0,0.7)',
    gap: Spacing.three,
    alignItems: 'center',
  },
  retakeButton: {
    backgroundColor: '#fff',
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.five,
    paddingTop: Spacing.three,
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: Radii.full,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: Radii.full,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
  },
  shutterDisabled: { opacity: 0.4 },
  workingBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  workingText: { color: '#fff' },
});
