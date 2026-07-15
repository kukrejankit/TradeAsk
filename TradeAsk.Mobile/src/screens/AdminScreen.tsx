import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
  StyleSheet, Platform, Switch, KeyboardAvoidingView, RefreshControl, Modal, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useAdmin } from '../contexts/AdminContext';
import { adminService } from '../services/adminService';
import type { Question, AdminStats, Expert } from '../types/admin';
import { timeAgo } from '../utils/timeAgo';
import type { RootStackParamList } from '../types/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL, FIREBASE_CONFIG, GOOGLE_WEB_CLIENT_ID } from '../services/config';

WebBrowser.maybeCompleteAuthSession();

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FILTERS = ['all', 'pending', 'expert_review', 'answered', 'escalated'] as const;
const SPECIALTIES = ['Electrical', 'Plumbing', 'Structural / Building', 'HVAC / Mechanical', 'OSHA & Safety', 'General Construction', 'Other'];

export function AdminScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { loggedIn, login, signup, firebaseLogin, logout, role, loading: authLoading } = useAdmin();

  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'com.kukrejankit.tradeask' });

  const handleGoogleLogin = async () => {
    if (!discovery) return;
    try {
      const request = new AuthSession.AuthRequest({
        clientId: GOOGLE_WEB_CLIENT_ID,
        scopes: ['openid', 'email', 'profile'],
        redirectUri,
        responseType: AuthSession.ResponseType.IdToken,
        extraParams: { nonce: Math.random().toString(36).slice(2) },
      });
      const result = await request.promptAsync(discovery);
      if (result.type === 'success' && result.params.id_token) {
        const googleIdToken = result.params.id_token;
        // Exchange Google ID token for Firebase ID token via REST API
        const firebaseRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_CONFIG.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postBody: `id_token=${googleIdToken}&providerId=google.com`,
              requestUri: redirectUri,
              returnIdpCredential: true,
              returnSecureToken: true,
            }),
          }
        );
        const firebaseData = await firebaseRes.json();
        if (firebaseData.idToken) {
          await firebaseLogin(firebaseData.idToken);
        } else {
          setLoginError(firebaseData.error?.message || 'Google sign-in failed');
        }
      }
    } catch (e: any) {
      setLoginError(e.message || 'Google sign-in failed');
    }
  };

  // Login state
  const [isSignup, setIsSignup] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupSpecialty, setSignupSpecialty] = useState('');
  const [showSpecialtyPicker, setShowSpecialtyPicker] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<'questions' | 'experts'>('questions');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Question detail (inline)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [finalAnswer, setFinalAnswer] = useState('');
  const [correctionNeeded, setCorrectionNeeded] = useState(false);
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [addToKb, setAddToKb] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [s, q] = await Promise.all([adminService.getStats(), adminService.getQuestions(filter === 'all' ? undefined : filter)]);
      setStats(s);
      setQuestions(q);
    } catch {} finally {
      setRefreshing(false);
    }
  }, [filter]);

  const loadExperts = useCallback(async () => {
    try {
      const data = await adminService.getExperts();
      setExperts(data);
    } catch {}
  }, []);

  useEffect(() => {
    if (loggedIn) {
      loadDashboard();
      if (role === 'super_admin') loadExperts();
    }
  }, [loggedIn, filter]);

  // Login/Signup handlers
  const handleLogin = async () => {
    setLoginError('');
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
    } catch (e: any) {
      setLoginError(e.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async () => {
    setLoginError('');
    if (!signupName || !signupSpecialty) { setLoginError('Name and specialty are required.'); return; }
    setLoginLoading(true);
    try {
      await signup({ email: loginEmail, password: loginPassword, name: signupName, specialty: signupSpecialty });
      setLoginError('');
      setIsSignup(false);
    } catch (e: any) {
      setLoginError(e.message || 'Signup failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotError('');
    setForgotMessage('');
    if (!forgotEmail) { setForgotError('Please enter your email.'); return; }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || 'Failed to send reset email');
      } else {
        setForgotMessage(data.message || 'If that email is registered, a reset link has been sent.');
      }
    } catch {
      setForgotError('Network error. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Question detail handlers
  const openQuestion = async (q: Question) => {
    setSelectedQuestion(q);
    setFinalAnswer(q.final_answer || q.claude_answer || '');
    setCorrectionNeeded(q.correction_needed);
    setCorrectionNotes(q.correction_notes || '');
    setAddToKb(q.added_to_kb);
  };

  const handleApprove = async () => {
    if (!selectedQuestion) return;
    setApproveLoading(true);
    try {
      await adminService.approveQuestion(selectedQuestion.id, {
        finalAnswer,
        correctionNeeded,
        correctionNotes: correctionNeeded ? correctionNotes : undefined,
        addedToKb: addToKb,
      });
      setSelectedQuestion(null);
      loadDashboard();
    } catch {} finally {
      setApproveLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!selectedQuestion) return;
    setApproveLoading(true);
    try {
      await adminService.escalateQuestion(selectedQuestion.id);
      setSelectedQuestion(null);
      loadDashboard();
    } catch {} finally {
      setApproveLoading(false);
    }
  };

  const handleRouteToExpert = async () => {
    if (!selectedQuestion) return;
    setApproveLoading(true);
    try {
      await adminService.routeToExpert(selectedQuestion.id);
      setSelectedQuestion(null);
      loadDashboard();
    } catch {} finally {
      setApproveLoading(false);
    }
  };

  // Login screen
  if (!loggedIn) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.loginWrapper} keyboardShouldPersistTaps="handled">
          <Text style={styles.loginTitle}>ExpertAsk Expert</Text>

          <View style={styles.loginCard}>
            {/* Google sign-in */}
            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin}>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Toggle */}
            <View style={styles.loginToggle}>
              <TouchableOpacity
                style={[styles.loginToggleBtn, !isSignup && styles.loginToggleBtnActive]}
                onPress={() => { setIsSignup(false); setLoginError(''); }}
              >
                <Text style={[styles.loginToggleText, !isSignup && styles.loginToggleTextActive]}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.loginToggleBtn, isSignup && styles.loginToggleBtnActive]}
                onPress={() => { setIsSignup(true); setLoginError(''); }}
              >
                <Text style={[styles.loginToggleText, isSignup && styles.loginToggleTextActive]}>Sign up</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.loginInput}
              placeholder="Email"
              value={loginEmail}
              onChangeText={setLoginEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.loginInput}
              placeholder="Password"
              value={loginPassword}
              onChangeText={setLoginPassword}
              secureTextEntry
            />

            {isSignup && (
              <>
                <TextInput
                  style={styles.loginInput}
                  placeholder="Full name"
                  value={signupName}
                  onChangeText={setSignupName}
                />
                <TouchableOpacity
                  style={styles.loginInput}
                  onPress={() => setShowSpecialtyPicker(true)}
                >
                  <Text style={signupSpecialty ? styles.pickerText : styles.pickerPlaceholder}>
                    {signupSpecialty || 'Select your specialty'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {loginError ? <Text style={styles.loginError}>{loginError}</Text> : null}

            <TouchableOpacity
              style={[styles.loginBtn, loginLoading && styles.loginBtnDisabled]}
              onPress={isSignup ? handleSignup : handleLogin}
              disabled={loginLoading}
            >
              <Text style={styles.loginBtnText}>{loginLoading ? 'Loading...' : isSignup ? 'Create account' : 'Login'}</Text>
            </TouchableOpacity>

            {!isSignup && (
              <TouchableOpacity style={styles.forgotBtn} onPress={() => { setShowForgotPassword(true); setForgotEmail(loginEmail); }}>
                <Text style={styles.forgotBtnText}>Forgot password?</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Specialty picker modal */}
          <Modal visible={showSpecialtyPicker} transparent animationType="fade">
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSpecialtyPicker(false)}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Specialty</Text>
                {SPECIALTIES.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.modalOption, signupSpecialty === s && styles.modalOptionActive]}
                    onPress={() => { setSignupSpecialty(s); setShowSpecialtyPicker(false); }}
                  >
                    <Text style={[styles.modalOptionText, signupSpecialty === s && styles.modalOptionTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>

          {/* Forgot password modal */}
          <Modal visible={showForgotPassword} transparent animationType="fade">
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowForgotPassword(false)}>
              <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                <Text style={styles.modalTitle}>Reset Password</Text>
                <Text style={styles.forgotDesc}>Enter your email and we'll send you a password reset link.</Text>
                <TextInput
                  style={styles.loginInput}
                  placeholder="Email"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {forgotError ? <Text style={styles.loginError}>{forgotError}</Text> : null}
                {forgotMessage ? <Text style={styles.forgotSuccess}>{forgotMessage}</Text> : null}
                <TouchableOpacity
                  style={[styles.loginBtn, forgotLoading && styles.loginBtnDisabled]}
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                >
                  <Text style={styles.loginBtnText}>{forgotLoading ? 'Sending...' : 'Send reset link'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.forgotBtn} onPress={() => setShowForgotPassword(false)}>
                  <Text style={styles.forgotBtnText}>Back to login</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Question detail view (inline)
  if (selectedQuestion) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.detailHeader, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => setSelectedQuestion(null)}>
            <Text style={styles.backBtn}>← Back to list</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailContent}>
          <Text style={styles.detailCategory}>{selectedQuestion.category}</Text>
          <Text style={styles.detailQuestion}>{selectedQuestion.question_text}</Text>
          <Text style={styles.detailMeta}>{selectedQuestion.user_email} · {timeAgo(selectedQuestion.created_at)}</Text>

          {selectedQuestion.file_path && (
            <View style={styles.attachmentBox}>
              <Text style={styles.attachmentText}>📎 {selectedQuestion.file_path}</Text>
            </View>
          )}

          {selectedQuestion.claude_answer && (
            <View style={styles.aiDraftBox}>
              <Text style={styles.aiDraftLabel}>AI Draft Answer</Text>
              <Text style={styles.aiDraftText}>{selectedQuestion.claude_answer}</Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>Final Answer</Text>
          <TextInput
            style={styles.answerInput}
            value={finalAnswer}
            onChangeText={setFinalAnswer}
            multiline
            placeholder="Edit or approve the answer..."
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>This is a correction</Text>
            <Switch value={correctionNeeded} onValueChange={setCorrectionNeeded} />
          </View>

          {correctionNeeded && (
            <TextInput
              style={styles.notesInput}
              value={correctionNotes}
              onChangeText={setCorrectionNotes}
              placeholder="Correction notes..."
              multiline
            />
          )}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Add to Knowledge Base</Text>
            <Switch value={addToKb} onValueChange={setAddToKb} />
          </View>

          <View style={styles.detailActions}>
            <TouchableOpacity
              style={[styles.approveBtn, approveLoading && styles.btnDisabled]}
              onPress={handleApprove}
              disabled={approveLoading}
            >
              <Text style={styles.approveBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.expertBtn, approveLoading && styles.btnDisabled]}
              onPress={handleRouteToExpert}
              disabled={approveLoading}
            >
              <Text style={styles.expertBtnText}>Send to Expert</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.escalateBtn, approveLoading && styles.btnDisabled]}
              onPress={handleEscalate}
              disabled={approveLoading}
            >
              <Text style={styles.escalateBtnText}>Escalate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backDetailBtn} onPress={() => setSelectedQuestion(null)}>
              <Text style={styles.backDetailBtnText}>Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Dashboard
  return (
    <View style={styles.container}>
      {/* Dashboard header */}
      <View style={[styles.dashHeader, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.dashTitle}>ExpertAsk Expert</Text>
        <View style={styles.dashTabs}>
          <TouchableOpacity
            style={[styles.dashTab, activeTab === 'questions' && styles.dashTabActive]}
            onPress={() => setActiveTab('questions')}
          >
            <Text style={[styles.dashTabText, activeTab === 'questions' && styles.dashTabTextActive]}>Questions</Text>
          </TouchableOpacity>
          {role === 'super_admin' && (
            <TouchableOpacity
              style={[styles.dashTab, activeTab === 'experts' && styles.dashTabActive]}
              onPress={() => { setActiveTab('experts'); loadExperts(); }}
            >
              <Text style={[styles.dashTabText, activeTab === 'experts' && styles.dashTabTextActive]}>Experts</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.dashActions}>
          <TouchableOpacity onPress={() => nav.navigate('Documents')}>
            <Text style={styles.docsLink}>Docs</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logoutLink}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'questions' ? (
        <FlatList
          data={questions}
          keyExtractor={item => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} />}
          ListHeaderComponent={
            <View>
              {/* Stats */}
              {stats && (
                <View style={styles.statsRow}>
                  <View style={styles.statCard}><Text style={styles.statNum}>{stats.total}</Text><Text style={styles.statLabel}>Total</Text></View>
                  <View style={styles.statCard}><Text style={styles.statNum}>{stats.pending}</Text><Text style={styles.statLabel}>Pending</Text></View>
                  <View style={styles.statCard}><Text style={styles.statNum}>{stats.answered}</Text><Text style={styles.statLabel}>Answered</Text></View>
                  <View style={styles.statCard}><Text style={styles.statNum}>{stats.correctionNeeded}</Text><Text style={styles.statLabel}>Corrected</Text></View>
                </View>
              )}
              {/* Filters */}
              <View style={styles.filterRow}>
                {FILTERS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, filter === f && styles.filterChipActive]}
                    onPress={() => setFilter(f)}
                  >
                    <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.questionRow} onPress={() => openQuestion(item)}>
              <View style={styles.questionTop}>
                <Text style={styles.questionCategory}>{item.category}</Text>
                <View style={[styles.questionStatus, item.status === 'pending' && styles.statusPending, item.status === 'escalated' && styles.statusEscalated, item.status === 'answered' && styles.statusAnswered]}>
                  <Text style={styles.questionStatusText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.questionText} numberOfLines={2}>{item.question_text}</Text>
              <Text style={styles.questionMeta}>{item.user_email} · {timeAgo(item.created_at)}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.questionList}
          ListEmptyComponent={<Text style={styles.emptyText}>No questions found.</Text>}
        />
      ) : (
        <FlatList
          data={experts}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.expertList}
          renderItem={({ item }) => (
            <View style={styles.expertCard}>
              <View>
                <Text style={styles.expertName}>{item.name}</Text>
                <Text style={styles.expertDetail}>{item.email} · {item.specialty}</Text>
                <Text style={styles.expertStatus}>Status: {item.status} · Role: {item.role}</Text>
              </View>
              {item.status === 'pending' && (
                <View style={styles.expertActions}>
                  <TouchableOpacity style={styles.approveSmall} onPress={() => adminService.approveExpert(item.id).then(loadExperts)}>
                    <Text style={styles.approveSmallText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectSmall} onPress={() => adminService.rejectExpert(item.id).then(loadExperts)}>
                    <Text style={styles.rejectSmallText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No experts found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Login
  loginWrapper: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  loginTitle: { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 24 },
  loginCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', padding: 24 },
  googleBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  googleBtnText: { fontSize: 15, fontWeight: '500', color: '#374151' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: '#9ca3af' },
  loginToggle: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 10, padding: 3, marginBottom: 16 },
  loginToggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  loginToggleBtnActive: { backgroundColor: '#111827' },
  loginToggleText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  loginToggleTextActive: { color: '#fff', fontWeight: '600' },
  loginInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  loginError: { color: '#dc2626', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  loginBtn: { backgroundColor: '#1a73e8', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  pickerText: { fontSize: 15, color: '#111827' },
  pickerPlaceholder: { fontSize: 15, color: '#9ca3af' },
  forgotBtn: { alignItems: 'center', marginTop: 14 },
  forgotBtnText: { fontSize: 14, color: '#1a73e8', fontWeight: '500' },
  forgotDesc: { fontSize: 13, color: '#6b7280', marginBottom: 14, textAlign: 'center' },
  forgotSuccess: { fontSize: 13, color: '#16a34a', marginBottom: 12, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%', maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 16 },
  modalOption: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, marginBottom: 4 },
  modalOptionActive: { backgroundColor: '#eff6ff' },
  modalOptionText: { fontSize: 15, color: '#374151' },
  modalOptionTextActive: { color: '#1a73e8', fontWeight: '600' },

  // Dashboard header
  dashHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  dashTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 10 },
  dashTabs: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  dashTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  dashTabActive: { backgroundColor: '#111827' },
  dashTabText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  dashTabTextActive: { color: '#fff' },
  dashActions: { flexDirection: 'row', gap: 16 },
  docsLink: { fontSize: 13, color: '#1a73e8', fontWeight: '500' },
  logoutLink: { fontSize: 13, color: '#6b7280' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 16 },
  statCard: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  statNum: { fontSize: 20, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  // Filters
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: '#f3f4f6' },
  filterChipActive: { backgroundColor: '#1a73e8' },
  filterChipText: { fontSize: 13, color: '#374151', textTransform: 'capitalize' },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },

  // Question list
  questionList: { paddingHorizontal: 16, paddingBottom: 20 },
  questionRow: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, marginBottom: 10 },
  questionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  questionCategory: { fontSize: 11, fontWeight: '700', color: '#1a73e8', textTransform: 'uppercase' },
  questionStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusPending: { backgroundColor: '#fef9c3' },
  statusEscalated: { backgroundColor: '#fee2e2' },
  statusAnswered: { backgroundColor: '#dcfce7' },
  questionStatusText: { fontSize: 10, fontWeight: '600', color: '#374151', textTransform: 'capitalize' },
  questionText: { fontSize: 14, fontWeight: '500', color: '#111827', lineHeight: 20 },
  questionMeta: { fontSize: 12, color: '#9ca3af', marginTop: 6 },

  // Detail
  detailHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { fontSize: 15, color: '#1a73e8', fontWeight: '500' },
  detailScroll: { flex: 1 },
  detailContent: { padding: 20 },
  detailCategory: { fontSize: 12, fontWeight: '700', color: '#1a73e8', textTransform: 'uppercase', marginBottom: 6 },
  detailQuestion: { fontSize: 17, fontWeight: '600', color: '#111827', lineHeight: 24, marginBottom: 8 },
  detailMeta: { fontSize: 13, color: '#9ca3af', marginBottom: 16 },
  attachmentBox: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, marginBottom: 16 },
  attachmentText: { fontSize: 13, color: '#374151' },
  aiDraftBox: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 14, marginBottom: 20 },
  aiDraftLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 6 },
  aiDraftText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  answerInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 14, fontSize: 14, minHeight: 120, textAlignVertical: 'top', marginBottom: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  switchLabel: { fontSize: 14, color: '#374151' },
  notesInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, fontSize: 14, minHeight: 60, textAlignVertical: 'top', marginBottom: 16 },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  approveBtn: { flex: 1, backgroundColor: '#16a34a', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  approveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  expertBtn: { flex: 1, backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  expertBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  escalateBtn: { flex: 1, backgroundColor: '#d97706', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  escalateBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  backDetailBtn: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db' },
  backDetailBtnText: { fontSize: 15, color: '#374151' },
  btnDisabled: { opacity: 0.6 },

  // Experts
  expertList: { padding: 16 },
  expertCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expertName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  expertDetail: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  expertStatus: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  expertActions: { flexDirection: 'row', gap: 6 },
  approveSmall: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  approveSmallText: { fontSize: 12, color: '#16a34a', fontWeight: '600' },
  rejectSmall: { backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  rejectSmallText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },

  emptyText: { textAlign: 'center', fontSize: 14, color: '#9ca3af', paddingVertical: 40 },
});
