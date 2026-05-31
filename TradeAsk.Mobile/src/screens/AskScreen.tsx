import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { api } from '../services/api';

const CATEGORIES = [
  'Electrical',
  'Plumbing',
  'Structural / Building',
  'HVAC / Mechanical',
  'OSHA & Safety',
  'General Construction',
  'Other',
];

export default function AskScreen() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [question, setQuestion] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, name: 'photo.jpg', type: 'image/jpeg' });
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, name: 'photo.jpg', type: 'image/jpeg' });
    }
  };

  const submit = async () => {
    if (!email || !category || !question || question.length < 10) {
      Alert.alert('Missing info', 'Please fill in your email, select a category, and write a question (min 10 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('category', category);
      formData.append('questionText', question);
      if (photo) {
        formData.append('file', { uri: photo.uri, name: photo.name, type: photo.type } as any);
      }

      await api.submitQuestion(formData);
      setSuccess(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit question');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Text style={styles.successCheck}>✓</Text>
        </View>
        <Text style={styles.successTitle}>Question received!</Text>
        <Text style={styles.successText}>We'll send your expert-reviewed answer to</Text>
        <Text style={styles.successEmail}>{email}</Text>
        <Text style={styles.successTime}>within 1 hour</Text>
        <TouchableOpacity style={styles.successButton} onPress={() => { setSuccess(false); setQuestion(''); setPhoto(null); }}>
          <Text style={styles.successButtonText}>Ask another question</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backHomeLink}>Back to home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backArrow}>←</Text>
        <Text style={styles.backText}>Ask a question</Text>
      </TouchableOpacity>

      {/* Email */}
      <Text style={styles.label}>Your email (we'll send the answer here)</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="your@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      {/* Category */}
      <Text style={styles.label}>Trade category</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, category === cat && styles.categoryActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Question */}
      <Text style={styles.label}>Your question</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={question}
        onChangeText={setQuestion}
        placeholder="Describe your question in detail..."
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {/* Photo */}
      <Text style={styles.label}>Attach a photo or document (optional)</Text>
      <TouchableOpacity style={styles.photoArea} onPress={pickImage}>
        {photo ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: photo.uri }} style={styles.previewImage} />
            <TouchableOpacity onPress={() => setPhoto(null)} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoIcon}>📷</Text>
            <Text style={styles.photoText}>Tap to add a photo or PDF</Text>
            <Text style={styles.photoSubtext}>Max 10MB</Text>
          </View>
        )}
      </TouchableOpacity>

      {!photo && (
        <TouchableOpacity style={styles.cameraButton} onPress={takePhoto}>
          <Text style={styles.cameraButtonText}>Take a photo instead</Text>
        </TouchableOpacity>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitDisabled]}
        onPress={submit}
        disabled={submitting}
      >
        <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Get my answer →'}</Text>
      </TouchableOpacity>

      <Text style={styles.footerNote}>AI answers instantly · expert reviews within 1 hour</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 60 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backArrow: { fontSize: 20, color: '#111', marginRight: 8 },
  backText: { fontSize: 18, fontWeight: '600', color: '#111' },
  label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: '#f8fafc' },
  textArea: { height: 110, textAlignVertical: 'top' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  categoryActive: { backgroundColor: '#0c4a6e', borderColor: '#0c4a6e' },
  categoryText: { fontSize: 13, color: '#374151' },
  categoryTextActive: { color: '#fff' },
  photoArea: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#e2e8f0', borderRadius: 12, overflow: 'hidden' },
  photoPlaceholder: { padding: 28, alignItems: 'center' },
  photoIcon: { fontSize: 28, marginBottom: 8 },
  photoText: { fontSize: 14, color: '#6b7280' },
  photoSubtext: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  photoPreview: { alignItems: 'center', padding: 12 },
  previewImage: { width: '100%', height: 180, borderRadius: 8 },
  removeBtn: { marginTop: 8 },
  removeBtnText: { color: '#dc2626', fontSize: 14, fontWeight: '500' },
  cameraButton: { marginTop: 8, alignItems: 'center' },
  cameraButtonText: { color: '#0284c7', fontSize: 14, fontWeight: '500' },
  submitButton: { backgroundColor: '#0c4a6e', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 24 },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footerNote: { textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 12 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#fff' },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  successCheck: { fontSize: 28, color: '#16a34a' },
  successTitle: { fontSize: 22, fontWeight: 'bold', color: '#111', marginBottom: 8 },
  successText: { fontSize: 15, color: '#6b7280' },
  successEmail: { fontSize: 15, fontWeight: '600', color: '#111', marginTop: 2 },
  successTime: { fontSize: 14, color: '#6b7280', marginTop: 2, marginBottom: 24 },
  successButton: { backgroundColor: '#0c4a6e', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  successButtonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  backHomeLink: { color: '#0284c7', fontSize: 14, marginTop: 16 },
});
