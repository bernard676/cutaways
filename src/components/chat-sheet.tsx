import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetFlatListMethods,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const snapPoints = useMemo(() => ['65%', '92%'], []);
  const listRef = useRef<BottomSheetFlatListMethods>(null);

  useEffect(() => {
    listChatMessages(topicId)
      .then(setMessages)
      .catch((err) => logger.error('ChatSheet', 'Failed to load chat history', err));
  }, [topicId]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, isSending]);

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
      // sendChatMessage has already persisted an assistant placeholder for this failure, so
      // this bubble just mirrors it into the open sheet without a second write.
      logger.error('ChatSheet', 'Failed to send chat message', err);
      setMessages((prev) => [
        ...prev,
        {
          id: localId(),
          topicId,
          userId: '',
          role: 'assistant',
          content: "Sorry, I couldn't answer that just now. Please try again.",
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
      index={1}
      snapPoints={snapPoints}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={{ backgroundColor: theme.backgroundElement }}
      handleIndicatorStyle={{ backgroundColor: theme.border }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      )}>
      <BottomSheetView style={styles.container}>
        <View style={themedStyles.header}>
          <ThemedText type="bodySemiBold">Ask Sketch Studios</ThemedText>
          {onClose && (
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close chat">
              <Ionicons name="close" size={18} color={theme.textFaint} />
            </Pressable>
          )}
        </View>

        <View style={themedStyles.contextBadge}>
          <ThemedText type="small" themeColor="accentHover">
            {selectedComponent ? selectedComponent.name : topicTitle}
          </ThemedText>
        </View>

        <BottomSheetFlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={styles.messageList}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            isSending ? (
              <View style={[styles.bubble, themedStyles.bubbleAssistant]}>
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
                item.role === 'user' ? themedStyles.bubbleUser : themedStyles.bubbleAssistant,
              ]}>
              <ThemedText themeColor={item.role === 'user' ? 'textInverse' : 'text'}>
                {item.content}
              </ThemedText>
            </View>
          )}
        />

        <View style={themedStyles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question…"
            placeholderTextColor={theme.textFaint}
            style={themedStyles.input}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            onPress={handleSend}
            disabled={isSending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ busy: isSending }}
            style={themedStyles.sendButton}>
            <Ionicons name="send" color={theme.textInverse} size={16} />
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.four },
  messageList: { flex: 1 },
  messages: { gap: Spacing.two, paddingBottom: Spacing.four },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});

function createThemedStyles(theme: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: Spacing.two,
      marginBottom: Spacing.two,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    contextBadge: {
      alignSelf: 'flex-start',
      backgroundColor: theme.accentSoft,
      borderRadius: Radii.full,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.one,
      marginBottom: Spacing.three,
    },
    bubbleUser: { backgroundColor: theme.accent, alignSelf: 'flex-end' },
    bubbleAssistant: { backgroundColor: theme.backgroundSunken, alignSelf: 'flex-start' },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingVertical: Spacing.three,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radii.full,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    sendButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
