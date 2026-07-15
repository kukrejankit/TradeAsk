import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

interface FileInfo {
  uri: string;
  name: string;
  type: string;
}

interface Props {
  onFileSelected: (file: FileInfo) => void;
  selectedFile: FileInfo | null;
  onClear: () => void;
}

export function FileAttachBar({ onFileSelected, selectedFile, onClear }: Props) {
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onFileSelected({
        uri: asset.uri,
        name: asset.fileName || 'camera_photo.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onFileSelected({
        uri: asset.uri,
        name: asset.fileName || 'photo.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onFileSelected({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      });
    }
  };

  if (selectedFile) {
    return (
      <View style={styles.preview}>
        <Text style={styles.fileName} numberOfLines={1}>{selectedFile.name}</Text>
        <TouchableOpacity onPress={onClear}>
          <Text style={styles.clearBtn}>x</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <TouchableOpacity style={styles.btn} onPress={takePhoto}>
        <Text style={styles.btnText}>Camera</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={pickImage}>
        <Text style={styles.btnText}>Photo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btn} onPress={pickDocument}>
        <Text style={styles.btnText}>File</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  btn: { backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  btnText: { fontSize: 13, color: '#555' },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e8f0fe',
    marginHorizontal: 12,
    borderRadius: 8,
  },
  fileName: { flex: 1, fontSize: 13, color: '#1a73e8' },
  clearBtn: { fontSize: 18, color: '#999', paddingHorizontal: 6 },
});
