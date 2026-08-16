import { File, Paths } from 'expo-file-system';
import { createAssetAsync, requestPermissionsAsync } from 'expo-media-library';

/** Downloads a remote image and saves it to the device's photo library. */
export async function saveImageToLibrary(uri: string, filename: string): Promise<void> {
  const { status } = await requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Photo library permission is required to save images');
  }

  const destination = new File(Paths.cache, filename);
  const file = destination.exists ? destination : await File.downloadFileAsync(uri, destination);
  await createAssetAsync(file.uri);
}
