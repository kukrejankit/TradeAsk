import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../services/api';

const CATEGORIES = ['All', 'Electrical', 'Plumbing', 'HVAC', 'Structural', 'Safety', 'Automotive'];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const [recentQuestions, setRecentQuestions] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useFocusEffect(useCallback(() => {
    api.getMyQuestions().then(setRecentQuestions).catch(() => {});
  }, []));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getStatusColor = (status: string) => {
    if (status === 'answered') return '#16a34a';
    if (status === 'escalated') return '#f59e0b';
    return '#6b7280';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'answered') return 'Answered';
    if (status === 'escalated') return 'Expert reviewing';
    return 'Pending';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandRow}>
            <Text style={styles.brand}>TradeAsk</Text>
            {'  '}
            <Text style={styles.betaBadge}>Beta</Text>
          </Text>
        </View>
      </View>

      {/* Greeting */}
      <Text style={styles.greeting}>{getGreeting()}</Text>
      <Text style={styles.headline}>What do you need answered today?</Text>

      {/* Two Action Cards */}
      <View style={styles.cardsRow}>
        <TouchableOpacity
          style={[styles.actionCard, styles.primaryCard]}
          onPress={() => navigation.navigate('Ask')}
        >
          <Text style={styles.primaryCardIcon}>💬</Text>
          <Text style={styles.primaryCardTitle}>Get an answer</Text>
          <Text style={styles.primaryCardSub}>AI + expert review</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, styles.secondaryCard]}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.secondaryCardIcon}>✓</Text>
          <Text style={styles.secondaryCardTitle}>My questions</Text>
          <Text style={styles.secondaryCardSub}>View answers</Text>
        </TouchableOpacity>
      </View>

      {/* Category Pills */}
      <Text style={styles.sectionTitle}>Browse by trade</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.pill, selectedCategory === cat && styles.pillActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.pillText, selectedCategory === cat && styles.pillTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recent Questions */}
      <View style={styles.recentHeader}>
        <Text style={styles.sectionTitle}>Recent questions</Text>
        <TouchableOpacity onPress={() => navigation.navigate('History')}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {recentQuestions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No questions yet. Ask your first!</Text>
        </View>
      ) : (
        recentQuestions.slice(0, 5).map(q => (
          <TouchableOpacity
            key={q.id}
            style={styles.questionItem}
            onPress={() => navigation.navigate('History')}
          >
            <View style={styles.questionLeft}>
              <Text style={styles.questionCategory}>{q.category}</Text>
              <Text style={styles.questionText} numberOfLines={2}>{q.question_text}</Text>
              <View style={styles.questionMeta}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(q.status) }]} />
                <Text style={styles.statusText}>{getStatusLabel(q.status)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brand: { fontSize: 22, fontWeight: 'bold', color: '#111' },
  betaBadge: { fontSize: 11, color: '#0284c7', backgroundColor: '#e0f2fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', fontWeight: '600' },
  greeting: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  headline: { fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 20 },
  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  actionCard: { flex: 1, padding: 16, borderRadius: 12, justifyContent: 'center' },
  primaryCard: { backgroundColor: '#0c4a6e' },
  primaryCardIcon: { fontSize: 24, marginBottom: 8 },
  primaryCardTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  primaryCardSub: { fontSize: 12, color: '#bae6fd', marginTop: 2 },
  secondaryCard: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  secondaryCardIcon: { fontSize: 24, marginBottom: 8 },
  secondaryCardTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  secondaryCardSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 12 },
  pillsScroll: { marginBottom: 24 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8, backgroundColor: '#fff' },
  pillActive: { backgroundColor: '#0c4a6e', borderColor: '#0c4a6e' },
  pillText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  pillTextActive: { color: '#fff' },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAll: { fontSize: 14, color: '#0284c7', fontWeight: '500' },
  questionItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  questionLeft: { flex: 1 },
  questionCategory: { fontSize: 11, fontWeight: '600', color: '#0284c7', textTransform: 'uppercase', marginBottom: 4 },
  questionText: { fontSize: 14, color: '#111', lineHeight: 20, marginBottom: 6 },
  questionMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: '#6b7280' },
  emptyState: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 14 },
});
