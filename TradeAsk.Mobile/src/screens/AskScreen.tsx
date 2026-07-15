import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useChat } from '../contexts/ChatContext';
import { chatService } from '../services/chatService';
import { isValidEmail } from '../utils/validation';
import { StreamingBubble } from '../components/StreamingBubble';
import { FileAttachBar } from '../components/FileAttachBar';
import { SessionSidebar } from '../components/SessionSidebar';
import type { ChatMessage } from '../types/chat';
import type { RootStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Ask'>;

const CATEGORIES = [
  'Technology & IT',
  'Legal & Compliance',
  'Finance & Tax',
  'Health & Medical',
  'Engineering & Construction',
  'Science & Research',
  'Business & Strategy',
  'Other',
];

export function AskScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const {
    identified, email: storedEmail, sessions,
    identify, createSession, loadSessions, setCurrentSession, currentSessionId, logout,
  } = useChat();

  // Identity state
  const [identifyMode, setIdentifyMode] = useState<'new' | 'returning'>('new');
  const [email, setEmail] = useState(storedEmail || '');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [identError, setIdentError] = useState('');
  const [identLoading, setIdentLoading] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [file, setFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [chatError, setChatError] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const sessionId = route.params?.sessionId || currentSessionId;

  useEffect(() => {
    if (identified) {
      loadSessions();
    }
  }, [identified]);

  useEffect(() => {
    if (sessionId && identified) {
      setCurrentSession(sessionId);
      loadMessages(sessionId);
    }
  }, [sessionId, identified]);

  useEffect(() => {
    if (storedEmail) setEmail(storedEmail);
  }, [storedEmail]);

  const loadMessages = async (id: string) => {
    try {
      const data = await chatService.getSession(id);
      setMessages(data.messages);
      setSelectedCategory(data.session.category);
    } catch {
      setChatError('Failed to load messages');
    }
  };

  // Identity handlers
  const handleStartSession = async () => {
    if (!isValidEmail(email)) { setIdentError('Please enter a valid email address.'); return; }
    if (!selectedCategory) { setIdentError('Please select a category.'); return; }
    setIdentError('');
    setIdentLoading(true);
    try {
      await createSession(email, selectedCategory);
      await loadSessions();
      setMessages([]);
    } catch (e: any) {
      setIdentError(e.message || 'Failed to start session.');
    } finally {
      setIdentLoading(false);
    }
  };

  const handleRetrieve = async () => {
    if (!isValidEmail(email)) { setIdentError('Please enter a valid email address.'); return; }
    setIdentError('');
    setIdentLoading(true);
    try {
      const found = await identify(email);
      if (found) {
        await loadSessions();
      } else {
        setIdentError('No sessions found for this email. Start a new conversation.');
      }
    } catch (e: any) {
      setIdentError(e.message || 'Failed to retrieve sessions.');
    } finally {
      setIdentLoading(false);
    }
  };

  // Chat handlers
  const selectCategoryInChat = (cat: string) => {
    setSelectedCategory(cat);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && !file) return;
    setChatError('');

    // If no session yet, create one
    if (!currentSessionId) {
      if (!selectedCategory) {
        setChatError('Please select a category first.');
        return;
      }
      try {
        await createSession(email, selectedCategory);
        await loadSessions();
      } catch {
        setChatError('Failed to start session.');
        return;
      }
    }

    setInput('');
    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      message_type: 'question',
      file_path: file?.name || null,
      file_type: file?.type || null,
      is_expert_reviewed: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setStreaming(true);
    setStreamContent('');

    try {
      let fullContent = '';
      for await (const event of chatService.streamMessage(text, file?.uri, file?.name, file?.type)) {
        if (event.type === 'token') {
          fullContent += event.data.text || event.data.content || '';
          setStreamContent(fullContent);
        } else if (event.type === 'done') {
          const isClarification = event.data.isClarification;
          const assistantMsg: ChatMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: fullContent,
            message_type: isClarification ? 'clarification' : 'answer',
            file_path: null,
            file_type: null,
            is_expert_reviewed: false,
            created_at: new Date().toISOString(),
          };
          setMessages(prev => [...prev, assistantMsg]);

          if (!isClarification) {
            const systemMsg: ChatMessage = {
              id: Date.now() + 2,
              role: 'system',
              content: 'Would you like to continue chatting, or send this answer for expert review?',
              message_type: 'review_prompt',
              file_path: null,
              file_type: null,
              is_expert_reviewed: false,
              created_at: new Date().toISOString(),
            };
            setMessages(prev => [...prev, systemMsg]);
          }
          setStreamContent('');
          loadSessions();
        } else if (event.type === 'error') {
          const errMsg: ChatMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: event.data.message || 'An error occurred.',
            message_type: 'answer',
            file_path: null,
            file_type: null,
            is_expert_reviewed: false,
            created_at: new Date().toISOString(),
          };
          setMessages(prev => [...prev, errMsg]);
          setStreamContent('');
        }
      }
    } catch {
      const sysMsg: ChatMessage = {
        id: Date.now() + 1,
        role: 'system',
        content: 'Failed to get AI response. Your question has been queued for expert review.',
        message_type: 'system',
        file_path: null,
        file_type: null,
        is_expert_reviewed: false,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, sysMsg]);
      setStreamContent('');
    } finally {
      setStreaming(false);
      setFile(null);
    }
  };

  const handleContinueChatting = () => {
    // Remove the review prompt system message so user can keep chatting
    setMessages(prev => prev.filter(m => m.message_type !== 'review_prompt'));
  };

  const handleSendForReview = () => {
    // Replace the review prompt with a confirmation message
    setMessages(prev => prev.map(m =>
      m.message_type === 'review_prompt'
        ? { ...m, content: 'Your answer has been sent for expert review. You\'ll receive an email once reviewed.', message_type: 'system' }
        : m
    ));
  };

  const handleChangeQuestion = async () => {
    if (currentSessionId) {
      try { await chatService.deleteSession(currentSessionId); } catch {}
    }
    setCurrentSession(null);
    setMessages([]);
    setSelectedCategory('');
    loadSessions();
  };

  const handleNewQuestion = () => {
    setCurrentSession(null);
    setMessages([]);
    setSelectedCategory('');
    setStreamContent('');
  };

  const handleSelectSession = useCallback((id: string) => {
    setMessages([]);
    setCurrentSession(id);
    loadMessages(id);
  }, []);

  const handleLogout = async () => {
    await logout();
    setMessages([]);
    setSelectedCategory('');
  };

  // Render identity step (when not identified)
  if (!identified) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.identityWrapper} keyboardShouldPersistTaps="handled">
          <View style={styles.identityCard}>
            <Text style={styles.identityTitle}>ExpertAsk</Text>
            <Text style={styles.identitySubtitle}>Get instant AI answers with expert review</Text>

            <View style={styles.toggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, identifyMode === 'new' && styles.toggleActive]}
                onPress={() => setIdentifyMode('new')}
              >
                <Text style={[styles.toggleText, identifyMode === 'new' && styles.toggleTextActive]}>New question</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, identifyMode === 'returning' && styles.toggleActive]}
                onPress={() => setIdentifyMode('returning')}
              >
                <Text style={[styles.toggleText, identifyMode === 'returning' && styles.toggleTextActive]}>Return to chat</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Your email</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="you@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {identifyMode === 'new' && (
              <>
                <Text style={styles.fieldLabel}>Trade category</Text>
                <View style={styles.selectWrapper}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                        onPress={() => setSelectedCategory(cat)}
                      >
                        <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </>
            )}

            {identError ? <Text style={styles.errorText}>{identError}</Text> : null}

            {identifyMode === 'new' ? (
              <TouchableOpacity
                style={[styles.actionBtn, identLoading && styles.actionBtnDisabled]}
                onPress={handleStartSession}
                disabled={identLoading}
              >
                <Text style={styles.actionBtnText}>{identLoading ? 'Starting...' : 'Start chatting →'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, identLoading && styles.actionBtnDisabled]}
                onPress={handleRetrieve}
                disabled={identLoading}
              >
                <Text style={styles.actionBtnText}>{identLoading ? 'Loading...' : 'Retrieve my chats'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Render chat interface (when identified)
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.msgRow}>
          <View style={styles.userBubble}>
            <Text style={styles.userBubbleText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    if (item.role === 'system') {
      const isReviewPrompt = item.message_type === 'review_prompt';
      return (
        <View style={styles.systemRow}>
          <View style={styles.systemBubble}>
            <Text style={styles.systemBubbleText}>{item.content}</Text>
          </View>
          <View style={styles.systemActions}>
            {isReviewPrompt ? (
              <>
                <TouchableOpacity style={styles.systemBtn} onPress={handleContinueChatting}>
                  <Text style={styles.systemBtnText}>Continue chatting</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.systemBtnPrimary} onPress={handleSendForReview}>
                  <Text style={styles.systemBtnPrimaryText}>Send for expert review</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.systemBtn} onPress={handleChangeQuestion}>
                  <Text style={styles.systemBtnText}>Change my question</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.systemBtnPrimary} onPress={handleNewQuestion}>
                  <Text style={styles.systemBtnPrimaryText}>New question</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      );
    }

    // Assistant
    return (
      <View style={styles.msgRowLeft}>
        <View style={styles.assistantBubble}>
          {item.is_expert_reviewed && (
            <View style={styles.reviewedBadge}>
              <Text style={styles.reviewedBadgeText}>✓ Expert reviewed</Text>
            </View>
          )}
          <Text style={styles.assistantBubbleText}>{item.content}</Text>
        </View>
      </View>
    );
  };

  const renderEmptyChat = () => {
    if (messages.length > 0) return null;
    if (!selectedCategory) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Select a category to start</Text>
          <View style={styles.emptyCatGrid}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={styles.emptyCatPill}
                onPress={() => selectCategoryInChat(cat)}
              >
                <Text style={styles.emptyCatPillText}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>
          Ask your <Text style={styles.emptyBold}>{selectedCategory}</Text> question below
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      {/* Header */}
      <View style={[styles.chatHeader, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.homeBtn} onPress={() => nav.navigate('Landing')}>
          <Text style={styles.homeIcon}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarOpen(true)}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentSessionId
              ? (sessions.find(s => s.id === currentSessionId)?.topic || selectedCategory || 'ExpertAsk')
              : 'New conversation'}
          </Text>
          <Text style={styles.headerEmail} numberOfLines={1}>{email}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.changeAccountText}>Change account</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>{renderEmptyChat()}</View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={streaming ? <StreamingBubble content={streamContent} isStreaming /> : null}
        />
      )}

      {/* Error */}
      {chatError ? (
        <View style={styles.chatErrorBar}>
          <Text style={styles.chatErrorText}>{chatError}</Text>
          <TouchableOpacity onPress={() => setChatError('')}><Text style={styles.chatErrorDismiss}>✕</Text></TouchableOpacity>
        </View>
      ) : null}

      {/* File attach */}
      <FileAttachBar onFileSelected={setFile} selectedFile={file} onClear={() => setFile(null)} />

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.chatInput}
          placeholder="Ask your trade question..."
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          editable={!streaming}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() && !file) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={streaming || (!input.trim() && !file)}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>

      {/* Sidebar */}
      <SessionSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewQuestion}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Identity step
  identityWrapper: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  identityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  identityTitle: { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center' },
  identitySubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 6, marginBottom: 24 },
  toggle: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 10, padding: 3, marginBottom: 20 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  toggleActive: { backgroundColor: '#111827' },
  toggleText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  selectWrapper: { marginBottom: 16 },
  categoryScroll: { flexGrow: 0 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  categoryChipActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  categoryChipText: { fontSize: 13, color: '#374151' },
  categoryChipTextActive: { color: '#fff', fontWeight: '600' },
  errorText: { color: '#dc2626', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  actionBtn: { backgroundColor: '#1a73e8', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Chat header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  homeBtn: { width: 36, height: 40, justifyContent: 'center', alignItems: 'center' },
  homeIcon: { fontSize: 20, color: '#1a73e8', fontWeight: '600' },
  menuBtn: { width: 36, height: 40, justifyContent: 'center', alignItems: 'center' },
  menuIcon: { fontSize: 20, color: '#6b7280' },
  headerCenter: { flex: 1, marginHorizontal: 8 },
  headerTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  headerEmail: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  changeAccountText: { fontSize: 12, color: '#6b7280', paddingHorizontal: 8, paddingVertical: 4 },

  // Messages
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 15, color: '#6b7280', marginBottom: 16, textAlign: 'center' },
  emptyBold: { fontWeight: '600', color: '#1a73e8' },
  emptyCatGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  emptyCatPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  emptyCatPillText: { fontSize: 13, color: '#374151' },

  messageList: { paddingVertical: 16, paddingHorizontal: 12 },
  msgRow: { alignItems: 'flex-end', marginVertical: 4 },
  msgRowLeft: { alignItems: 'flex-start', marginVertical: 4 },
  userBubble: {
    backgroundColor: '#1a73e8',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  userBubbleText: { fontSize: 15, color: '#fff', lineHeight: 21 },
  assistantBubble: {
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  assistantBubbleText: { fontSize: 15, color: '#1f2937', lineHeight: 21 },
  reviewedBadge: { marginBottom: 4 },
  reviewedBadgeText: { fontSize: 11, color: '#16a34a', fontWeight: '600', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },

  // System messages
  systemRow: { alignItems: 'center', marginVertical: 12 },
  systemBubble: {
    backgroundColor: '#fefce8',
    borderWidth: 1,
    borderColor: '#fef08a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: '90%',
  },
  systemBubbleText: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 18 },
  systemActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  systemBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  systemBtnText: { fontSize: 12, color: '#4b5563' },
  systemBtnPrimary: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  systemBtnPrimaryText: { fontSize: 12, color: '#fff', fontWeight: '500' },

  // Error bar
  chatErrorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#fecaca',
  },
  chatErrorText: { flex: 1, fontSize: 13, color: '#dc2626' },
  chatErrorDismiss: { fontSize: 16, color: '#999', paddingLeft: 8 },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    backgroundColor: '#fff',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: { backgroundColor: '#d1d5db' },
  sendIcon: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
