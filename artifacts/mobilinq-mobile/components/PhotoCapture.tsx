import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

const MAX_BYTES = 2_800_000;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function PhotoCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const colors = useColors();
  const [message, setMessage] = useState('');
  const capture = async (camera: boolean) => {
    setMessage('');
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setMessage(permission.canAskAgain ? 'Camera permission is needed to capture a repair photo.' : 'Camera access is disabled. Enable it in device settings.');
        return;
      }
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.78 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.78 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mime = asset.mimeType ?? 'image/jpeg';
    if (!allowedTypes.has(mime) || !asset.base64) {
      setMessage('Use a JPEG, PNG, or WebP image.');
      return;
    }
    if ((asset.fileSize ?? asset.base64.length * 0.75) > MAX_BYTES) {
      setMessage('Photo is too large. Choose an image under 2.8 MB.');
      return;
    }
    onCapture(`data:${mime};base64,${asset.base64}`);
  };
  return (
    <View>
      <View style={styles.actions}>
        <Pressable testID="take-photo" accessibilityRole="button" onPress={() => void capture(true)} style={[styles.button, { borderColor: colors.primary }]}>
          <Feather name="camera" size={16} color={colors.primary} />
          <Text style={[styles.buttonText, { color: colors.primary }]}>TAKE PHOTO</Text>
        </Pressable>
        <Pressable testID="choose-photo" accessibilityRole="button" onPress={() => void capture(false)} style={[styles.button, { borderColor: colors.border }]}>
          <Feather name="image" size={16} color={colors.mutedForeground} />
          <Text style={[styles.buttonText, { color: colors.mutedForeground }]}>CHOOSE</Text>
        </Pressable>
      </View>
      {!!message && <Text style={[styles.message, { color: colors.destructive }]}>{message}</Text>}
      {Platform.OS === 'web' ? <Text style={[styles.hint, { color: colors.mutedForeground }]}>Camera capture uses the browser permission when available.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 9, flexWrap: 'wrap' },
  button: { minHeight: 42, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  buttonText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  message: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  hint: { fontSize: 11, marginTop: 7 },
});