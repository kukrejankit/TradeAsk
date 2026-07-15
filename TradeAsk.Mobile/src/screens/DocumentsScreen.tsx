import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { documentService } from '../services/documentService';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { timeAgo } from '../utils/timeAgo';
import type { Document } from '../types/admin';
import type { RootStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES = ['All', 'Electrical', 'Plumbing', 'Structural / Building', 'HVAC / Mechanical', 'OSHA & Safety', 'General Construction', 'Other'];

export function DocumentsScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { load(); }, [category]);

  const load = async () => {
    try {
      const data = await documentService.getDocuments(category === 'All' ? undefined : category);
      setDocuments(data);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const uploadCategory = category === 'All' ? 'General Construction' : category;
    setUploading(true);
    try {
      await documentService.upload(asset.uri, asset.name, asset.mimeType || 'application/octet-stream', uploadCategory);
      load();
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Document', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await documentService.deleteDocument(id); load(); } },
    ]);
  };

  const handleReprocess = async (id: string) => {
    try {
      await documentService.reprocessDocument(id);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Documents</Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload} disabled={uploading}>
          <Text style={styles.uploadBtnText}>{uploading ? 'Uploading...' : '+ Upload'}</Text>
        </TouchableOpacity>
      </View>

      {/* Category filters */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={item => item}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterPill, category === item && styles.filterPillActive]}
            onPress={() => setCategory(item)}
          >
            <Text style={[styles.filterPillText, category === item && styles.filterPillTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={documents}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.fileName} numberOfLines={1}>{item.original_name}</Text>
              <Text style={styles.cardMeta}>{item.category} · {item.chunk_count} chunks · {timeAgo(item.uploaded_at)}</Text>
              <Text style={[styles.status, {
                color: item.status === 'ready' ? '#16a34a' : item.status === 'processing' ? '#d97706' : '#dc2626'
              }]}>{item.status}</Text>
            </View>
            <View style={styles.cardActions}>
              {item.status === 'error' && (
                <TouchableOpacity style={styles.retryBtn} onPress={() => handleReprocess(item.id)}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleDelete(item.id, item.original_name)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No documents uploaded</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  backBtn: { fontSize: 15, color: '#1a73e8', fontWeight: '500' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  uploadBtn: { backgroundColor: '#1a73e8', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  uploadBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  filterPillActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  filterPillText: { fontSize: 13, color: '#374151' },
  filterPillTextActive: { color: '#fff', fontWeight: '600' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  cardInfo: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  cardMeta: { fontSize: 12, color: '#6b7280', marginTop: 3 },
  status: { fontSize: 11, fontWeight: '600', marginTop: 3, textTransform: 'uppercase' },
  cardActions: { gap: 8, alignItems: 'flex-end' },
  retryBtn: { backgroundColor: '#fef9c3', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  retryText: { fontSize: 12, color: '#d97706', fontWeight: '600' },
  deleteText: { fontSize: 12, color: '#dc2626' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
});
