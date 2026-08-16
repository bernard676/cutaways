import { Ionicons } from '@expo/vector-icons';
import { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetModal } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { logger } from '@/lib/logger';
import { listChatMessages, sendChatMessage } from '@/services/chat';
import { ChatMessage, TopicComponent } from '@/types/knowledge';

interface ChatSheetProps {
  topicId: string;
  topicTitle: string;
  selectedComponent: TopicComponent | null;
  onClose?: () => void;
}

let localIdCounter = 0;
function localId() {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

export const ChatSheet = forwardRef<BottomSheetModal, ChatSheetProps>(function ChatSheet(
  { topicId, topicTitle, selectedComponent, onClose },
  ref
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const snapPoints = useMemo(() => ['65%', '92%'], []);

  useEffect(() => {
    listChatMessages(topicId)
      .then(setMessages)
      .catch((err) => logger.error('ChatSheet', 'Failed to load chat history', err));
  }, [topicId]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');

    const componentId = selectedComponent?.id ?? null;
    setMessages((prev) => [
      ...prev,
      {
        id: localId(),
        topicId,
        userId: '',
        role: 'user',
        content: text,
        componentContextId: componentId,
        createdAt: new Date().toISOString(),
      },
    ]);
    setIsSending(true);

    try {
      const reply = await sendChatMessage(topicId, text, componentId);
      setMessages((prev) => [
        ...prev,
        {
          id: localId(),
          topicId,
          userId: '',
          role: 'assistant',
          content: reply,
          componentContextId: componentId,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      logger.error('ChatSheet', 'Failed to send chat message', err);
      setMessages((prev) => [
        ...prev,
        {
          id: localId(),
          topicId,
          userId: '',
          role: 'assistant',
          content: "Sorry, I couldn't answer that just now.",
          componentContextId: null,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={{ backgroundColor: Colors.light.backgroundElement }}
      handleIndicatorStyle={{ backgroundColor: Colors.light.border }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}>
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="bodySemiBold">Ask Visualpedia</ThemedText>
          {onClose && (
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={18} color={Colors.light.textFaint} />
            </Pressable>
          )}
        </View>

        <View style={styles.contextBadge}>
          <ThemedText type="small" themeColor="accentHover">
            {selectedComponent ? selectedComponent.name : topicTitle}
          </ThemedText>
        </View>

        <BottomSheetFlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messages}
          ListFooterComponent={
            isSending ? (
              <View style={[styles.bubble, styles.bubbleAssistant]}>
                <ThemedText type="mono" themeColor="textMuted">
                  ···
                </ThemedText>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
              ]}>
              <ThemedText themeColor={item.role === 'user' ? 'textInverse' : 'text'}>
                {item.content}
              </ThemedText>
            </View>
          )}
        />

        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question…"
            placeholderTextColor={Colors.light.textFaint}
            style={styles.input}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable onPress={handleSend} disabled={isSending} style={styles.sendButton}>
            <Ionicons name="send" color={Colors.light.textInverse} size={16} />
          </Pressable>
        </View>
      </View>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.four },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.two,
    marginBottom: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  contextBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.light.accentSoft,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    marginBottom: Spacing.three,
  },
  messages: { gap: Spacing.two, paddingBottom: Spacing.four },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  bubbleUser: { backgroundColor: Colors.light.accent, alignSelf: 'flex-end' },
  bubbleAssistant: { backgroundColor: Colors.light.backgroundSunken, alignSelf: 'flex-start' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
