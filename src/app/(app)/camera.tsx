import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
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
  | { kind: 'ready' }
  | { kind: 'working' }
  | { kind: 'error'; message: string };

export default function CameraScreen() {
  // The React Compiler (experiments.reactCompiler) can over-memoize native components whose
  // props are callbacks; keep this screen out of it so the camera surface always re-mounts.
  'use no memo';

  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [status, setStatus] = useState<Status>({ kind: 'ready' });
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const busy = status.kind === 'working';

  async function capture() {
    if (busy || !cameraReady || !cameraRef.current) return;
    setStatus({ kind: 'working' });
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (!photo?.uri) throw new Error('The camera returned no image');

      const resized = await manipulateAsync(photo.uri, [{ resize: { width: MAX_EDGE } }], {
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
      logger.error('CameraScreen', 'Scan failed', err);
      setStatus({
        kind: 'error',
        message: err instanceof ApiError ? GENERIC_ERROR_MESSAGE : "Couldn't take that photo. Try again.",
      });
    }
  }

  // Permission state still loading.
  if (!permission) {
    return <View style={styles.blackout} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.blackout, styles.centered]}>
        <Ionicons name="camera-outline" size={40} color="#fff" />
        <ThemedText type="body" style={styles.permissionText}>
          Sketch Studios needs camera access to identify objects you photograph.
        </ThemedText>
        <Pressable
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
          accessibilityRole="button"
          style={styles.primaryButton}>
          <ThemedText type="bodySemiBold" style={styles.primaryButtonText}>
            {permission.canAskAgain ? 'Allow camera access' : 'Open Settings to enable it'}
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

  return (
    <View style={styles.blackout}>
      {/* Only mount the camera while this screen is actually focused -- an Android camera
          surface left mounted behind another screen comes back black. */}
      {isFocused && status.kind !== 'error' ? (
        <CameraView
          key={facing}
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          animateShutter={false}
          onCameraReady={() => setCameraReady(true)}
          onMountError={(e) => {
            logger.error('CameraScreen', 'Camera failed to start', e);
            setStatus({ kind: 'error', message: "This device's camera could not be started." });
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
            <ThemedText type="small" style={styles.errorText}>
              {status.message}
            </ThemedText>
            <Pressable
              onPress={() => {
                setCameraReady(false);
                setStatus({ kind: 'ready' });
              }}
              accessibilityRole="button"
              style={styles.retakeButton}>
              <ThemedText type="bodySemiBold" style={styles.primaryButtonText}>
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
          <View style={styles.controlSide} />

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

          <View style={styles.controlSide}>
            <Pressable
              onPress={() => {
                setCameraReady(false);
                setFacing((f) => (f === 'back' ? 'front' : 'back'));
              }}
              disabled={busy || status.kind === 'error'}
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
              hitSlop={8}
              style={styles.iconButton}>
              <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
            </Pressable>
          </View>
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
  permissionText: { color: '#fff', textAlign: 'center' },
  dimText: { color: 'rgba(255,255,255,0.6)' },
  primaryButton: {
    backgroundColor: '#fff',
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  primaryButtonText: { color: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  iconButton: {
    width: 44,
    height: 44,
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
    alignItems: 'flex-start',
  },
  errorText: { color: '#fff' },
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
  controlSide: { width: 44, alignItems: 'center' },
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
