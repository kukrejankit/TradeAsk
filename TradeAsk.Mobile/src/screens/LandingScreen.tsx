import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function LandingScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
      {/* Beta Badge */}
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>AI answer + verified expert review</Text>
          <View style={styles.betaTag}><Text style={styles.betaText}>Beta</Text></View>
        </View>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.title}>Expert answers, not just AI guesses</Text>
        <Text style={styles.subtitle}>
          Ask any question. AI responds instantly — then a human expert reviews, corrects, and verifies the answer.
        </Text>
      </View>

      {/* Two-Path Cards */}
      <View style={styles.cards}>
        {/* Get an Answer */}
        <View style={[styles.card, styles.cardFeatured]}>
          <Text style={styles.cardIcon}>❓</Text>
          <Text style={styles.cardTitle}>Get an answer</Text>
          <Text style={styles.cardDesc}>Ask any question and get an AI response verified by a real human expert.</Text>
          <View style={styles.bullets}>
            <Text style={styles.bullet}>⚡ AI response in seconds</Text>
            <Text style={styles.bullet}>👤 Expert reviews within 1 hour</Text>
            <Text style={styles.bullet}>✉️ Answer sent to your email</Text>
            <Text style={styles.bullet}>🔓 No account needed</Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => nav.navigate('Ask')}>
            <Text style={styles.primaryBtnText}>Ask a question →</Text>
          </TouchableOpacity>
        </View>

        {/* Share Expertise */}
        <View style={[styles.card, styles.cardSecondary]}>
          <Text style={styles.cardIcon}>🛡️</Text>
          <Text style={styles.cardTitle}>Share your expertise</Text>
          <Text style={styles.cardDesc}>Browse questions in your field and help people get expert-verified answers.</Text>
          <View style={styles.bullets}>
            <Text style={styles.bullet}>📦 Browse open questions</Text>
            <Text style={styles.bullet}>🔍 Filter by your specialty</Text>
            <Text style={styles.bullet}>✏️ Review or improve AI answers</Text>
            <Text style={styles.bullet}>⭐ Build a reputation over time</Text>
          </View>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => nav.navigate('Expert')}>
            <Text style={styles.secondaryBtnText}>Start answering →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* How It Works */}
      <View style={styles.howSection}>
        <Text style={styles.howTitle}>HOW IT WORKS</Text>
        <View style={styles.steps}>
          <View style={styles.step}>
            <Text style={styles.stepLabel}>Step 1</Text>
            <Text style={styles.stepText}>You ask your question — no account needed</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepLabel}>Step 2</Text>
            <Text style={styles.stepText}>AI drafts an answer, expert reviews and approves</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepLabel}>Step 3</Text>
            <Text style={styles.stepText}>You get notified when an expert reviews your answer</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        Your documents are processed securely and deleted after answering. Free during beta.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingBottom: 40 },
  badgeRow: { alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  badgeText: { fontSize: 13, color: '#1d4ed8', fontWeight: '500' },
  betaTag: { marginLeft: 8, backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  betaText: { fontSize: 11, color: '#1e40af', fontWeight: '700' },
  hero: { alignItems: 'center', paddingHorizontal: 24, marginTop: 24, marginBottom: 28 },
  title: { fontSize: 28, fontWeight: '800', color: '#111827', textAlign: 'center', lineHeight: 36 },
  subtitle: { fontSize: 15, color: '#4b5563', textAlign: 'center', marginTop: 12, lineHeight: 22 },
  cards: { paddingHorizontal: 16, gap: 16 },
  card: { borderRadius: 14, padding: 22 },
  cardFeatured: { borderWidth: 2, borderColor: '#1a73e8', backgroundColor: '#fff' },
  cardSecondary: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  cardIcon: { fontSize: 24, marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#4b5563', marginBottom: 14, lineHeight: 18 },
  bullets: { gap: 8, marginBottom: 18 },
  bullet: { fontSize: 13, color: '#374151', lineHeight: 18 },
  primaryBtn: { backgroundColor: '#1a73e8', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryBtn: { borderWidth: 2, borderColor: '#1a73e8', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  secondaryBtnText: { color: '#1a73e8', fontSize: 15, fontWeight: '600' },
  howSection: { marginTop: 32, backgroundColor: '#f9fafb', paddingVertical: 32, paddingHorizontal: 16 },
  howTitle: { textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#6b7280', letterSpacing: 1, marginBottom: 20 },
  steps: { gap: 12 },
  step: { backgroundColor: '#fff', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  stepLabel: { fontSize: 11, fontWeight: '700', color: '#1a73e8', textTransform: 'uppercase', marginBottom: 6 },
  stepText: { fontSize: 14, color: '#374151', fontWeight: '500', textAlign: 'center' },
  footer: { textAlign: 'center', fontSize: 12, color: '#6b7280', paddingHorizontal: 24, paddingVertical: 20 },
});
