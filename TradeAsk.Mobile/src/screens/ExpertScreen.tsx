import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { publicService, PublicQuestion } from '../services/publicService';
import { timeAgo } from '../utils/timeAgo';
import type { RootStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES = ['All', 'Technology & IT', 'Legal & Compliance', 'Finance & Tax', 'Health & Medical', 'Engineering & Construction', 'Science & Research', 'Business & Strategy', 'Other'];

export function ExpertScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQuestions = useCallback(async (cat?: string) => {
    try {
      const data = await publicService.getPublicQuestions(cat === 'All' ? undefined : cat);
      setQuestions(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions(activeCategory);
  }, [activeCategory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchQuestions(activeCategory);
  };

  const renderQuestion = ({ item }: { item: PublicQuestion }) => (
    <TouchableOpacity style={styles.card} onPress={() => nav.navigate('Admin')}>
      <View style={styles.cardTop}>
        <Text style={styles.cardCategory}>{item.category}</Text>
        <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
      </View>
      <Text style={styles.cardQuestion} numberOfLines={3}>{item.question_text}</Text>
      <View style={styles.cardBottom}>
        <Text style={styles.answerLink}>Answer this →</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>Open Questions</Text>
            <Text style={styles.headerSubtitle}>Help others get accurate, expert-reviewed answers</Text>
          </View>
          <TouchableOpacity style={styles.signInBtn} onPress={() => nav.navigate('Admin')}>
            <Text style={styles.signInBtnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category filters */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterPill, activeCategory === item && styles.filterPillActive]}
              onPress={() => setActiveCategory(item)}
            >
              <Text style={[styles.filterPillText, activeCategory === item && styles.filterPillTextActive]}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Questions list */}
      {loading ? (
        <View style={styles.centerMessage}>
          <Text style={styles.loadingText}>Loading questions...</Text>
        </View>
      ) : questions.length === 0 ? (
        <View style={styles.centerMessage}>
          <Text style={styles.emptyTitle}>No open questions in this category right now.</Text>
          <Text style={styles.emptySubtitle}>Check back soon — new questions come in daily.</Text>
        </View>
      ) : (
        <FlatList
          data={questions}
          keyExtractor={item => String(item.id)}
          renderItem={renderQuestion}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListFooterComponent={
            <View style={styles.footer}>
              <Text style={styles.footerText}>Want to help answer these questions?</Text>
              <TouchableOpacity style={styles.footerBtn} onPress={() => nav.navigate('Admin')}>
                <Text style={styles.footerBtnText}>Sign in as an expert →</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextBlock: { flex: 1, marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  signInBtn: { backgroundColor: '#1a73e8', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  signInBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  filterRow: { paddingTop: 14, paddingBottom: 6 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  filterPillActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  filterPillText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  filterPillTextActive: { color: '#fff' },

  listContent: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 18,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardCategory: { fontSize: 11, fontWeight: '700', color: '#1a73e8', textTransform: 'uppercase' },
  cardTime: { fontSize: 11, color: '#9ca3af' },
  cardQuestion: { fontSize: 15, fontWeight: '500', color: '#111827', lineHeight: 22 },
  cardBottom: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12 },
  answerLink: { fontSize: 13, fontWeight: '600', color: '#1a73e8' },

  centerMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontSize: 15, color: '#6b7280' },
  emptyTitle: { fontSize: 15, color: '#6b7280', textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 4 },

  footer: { alignItems: 'center', paddingTop: 20, paddingBottom: 8 },
  footerText: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  footerBtn: { backgroundColor: '#1a73e8', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  footerBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
