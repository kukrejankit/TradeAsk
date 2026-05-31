import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../services/api';

export default function HistoryScreen() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const loadQuestions = async () => {
    try {
      const data = await api.getMyQuestions();
      setQuestions(data);
    } catch (error) {
      console.error('Failed to load questions:', error);
    }
  };

  useFocusEffect(useCallback(() => { loadQuestions(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadQuestions();
    setRefreshing(false);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'answered') return { text: 'Reviewed', bg: '#dcfce7', color: '#166534' };
    if (status === 'escalated') return { text: 'Expert reviewing', bg: '#fef3c7', color: '#92400e' };
    return { text: 'Pending', bg: '#f1f5f9', color: '#475569' };
  };

  const timeAgo = (dateStr: string) => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (selected) {
    const badge = getStatusBadge(selected.status);
    return (
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backRow}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>Your answer</Text>
          </TouchableOpacity>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        </View>

        {/* Question */}
        <Text style={styles.detailCategory}>{selected.category}</Text>
        <Text style={styles.detailQuestion}>{selected.question_text}</Text>

        {/* Answer */}
        {selected.final_answer ? (
          <View style={styles.answerContainer}>
            {/* Source badges */}
            <View style={styles.sourceBadges}>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI draft</Text>
              </View>
              <View style={styles.expertBadge}>
                <Text style={styles.expertBadgeText}>Reviewed by expert</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>Verified</Text>
              </View>
            </View>

            <Text style={styles.answerText}>{selected.final_answer}</Text>

            {/* Feedback */}
            <View style={styles.feedbackSection}>
              <Text style={styles.feedbackLabel}>Was this helpful?</Text>
              <View style={styles.feedbackButtons}>
                <TouchableOpacity style={styles.feedbackBtn}>
                  <Text style={styles.feedbackBtnText}>👍 Yes, helpful</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.feedbackBtn, styles.feedbackBtnNo]}>
                  <Text style={styles.feedbackBtnText}>👎 Not quite</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : selected.claude_answer ? (
          <View style={styles.pendingAnswer}>
            <View style={styles.sourceBadges}>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI draft</Text>
              </View>
              <View style={[styles.expertBadge, { backgroundColor: '#fef3c7' }]}>
                <Text style={[styles.expertBadgeText, { color: '#92400e' }]}>Awaiting expert review</Text>
              </View>
            </View>
            <Text style={styles.answerText}>{selected.claude_answer}</Text>
            <Text style={styles.pendingNote}>An expert is reviewing this answer. You'll be notified when verified.</Text>
          </View>
        ) : (
          <View style={styles.waitingBox}>
            <Text style={styles.waitingIcon}>⏳</Text>
            <Text style={styles.waitingTitle}>Working on your answer</Text>
            <Text style={styles.waitingText}>AI is generating a draft. An expert will review it shortly.</Text>
          </View>
        )}

        <Text style={styles.detailTime}>Asked {timeAgo(selected.created_at)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Questions</Text>
      <FlatList
        data={questions}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const badge = getStatusBadge(item.status);
          return (
            <TouchableOpacity style={styles.item} onPress={() => setSelected(item)}>
              <View style={styles.itemTop}>
                <Text style={styles.itemCategory}>{item.category}</Text>
                <View style={[styles.itemStatusBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.itemStatusText, { color: badge.color }]}>{badge.text}</Text>
                </View>
              </View>
              <Text style={styles.itemQuestion} numberOfLines={2}>{item.question_text}</Text>
              <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No questions yet</Text>
            <Text style={styles.emptyText}>Your questions and answers will appear here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60 },
  title: { fontSize: 22, fontWeight: 'bold', paddingHorizontal: 20, marginBottom: 16, color: '#111' },
  item: { padding: 16, marginHorizontal: 16, marginBottom: 8, backgroundColor: '#f8fafc', borderRadius: 12 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemCategory: { fontSize: 11, fontWeight: '600', color: '#0284c7', textTransform: 'uppercase' },
  itemStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  itemStatusText: { fontSize: 11, fontWeight: '600' },
  itemQuestion: { fontSize: 14, color: '#111', lineHeight: 20, marginBottom: 6 },
  itemTime: { fontSize: 12, color: '#9ca3af' },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111', marginBottom: 4 },
  emptyText: { fontSize: 14, color: '#9ca3af' },
  // Detail view
  detailContainer: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backRow: { flexDirection: 'row', alignItems: 'center' },
  backArrow: { fontSize: 20, color: '#111', marginRight: 8 },
  backText: { fontSize: 18, fontWeight: '600', color: '#111' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  detailCategory: { fontSize: 12, fontWeight: '600', color: '#0284c7', textTransform: 'uppercase', marginBottom: 6 },
  detailQuestion: { fontSize: 17, fontWeight: '600', color: '#111', lineHeight: 24, marginBottom: 20 },
  answerContainer: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16 },
  sourceBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  aiBadge: { backgroundColor: '#e0f2fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  aiBadgeText: { fontSize: 11, fontWeight: '600', color: '#0369a1' },
  expertBadge: { backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  expertBadgeText: { fontSize: 11, fontWeight: '600', color: '#065f46' },
  verifiedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  verifiedBadgeText: { fontSize: 11, fontWeight: '600', color: '#166534' },
  answerText: { fontSize: 15, color: '#374151', lineHeight: 22 },
  feedbackSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  feedbackLabel: { fontSize: 14, color: '#6b7280', marginBottom: 10 },
  feedbackButtons: { flexDirection: 'row', gap: 10 },
  feedbackBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', backgroundColor: '#fff' },
  feedbackBtnNo: {},
  feedbackBtnText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  pendingAnswer: { backgroundColor: '#fffbeb', borderRadius: 12, padding: 16, marginBottom: 16 },
  pendingNote: { fontSize: 12, color: '#92400e', marginTop: 12, fontStyle: 'italic' },
  waitingBox: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 16 },
  waitingIcon: { fontSize: 28, marginBottom: 8 },
  waitingTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 },
  waitingText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  detailTime: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
});
