import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS, FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { ChatListItem } from '../components/ChatListItem';
import { EmptyState } from '../../../components/EmptyState';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { fetchArchivedChats } from '../services/chatService';
import { showErrorAlert } from '../../../utils/errorUtils';

function getChatName(chat, uid) {
  if (chat.type === 'group') return chat.name || chat.title || 'Group Chat';
  const other = chat.members?.find((member) => member.id !== uid);
  return other?.displayName || other?.username || 'Blink User';
}

export function ArchivedChatsScreen({ navigation }) {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await fetchArchivedChats();
      setChats(list);
    } catch (error) {
      showErrorAlert(error, 'Could not load archived chats.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          hitSlop={12}
          activeScale={0.9}
          borderless
          rippleColor={PRESS_FEEDBACK.softRipple}
          style={styles.headerBtn}>
          <AppIcon name="arrow-left" size={22} color={COLORS.primary} />
        </PressableScale>
        <Text style={styles.title}>Archived</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading && chats.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item }) => (
            <ChatListItem
              chat={item}
              currentUid={user?.uid}
              onPress={() => {
                const other = item.type === 'direct'
                  ? item.members?.find((m) => m.id !== user?.uid)
                  : null;
                navigation.navigate('ChatRoom', {
                  chatId: item.id,
                  chatName: getChatName(item, user?.uid),
                  isGroup: item.type === 'group',
                  members: item.members || [],
                  otherUserId: other?.id || null,
                });
              }}
              onLongPress={() => {
                const other = item.type === 'direct'
                  ? item.members?.find((m) => m.id !== user?.uid)
                  : null;
                navigation.navigate('ChatSettings', {
                  chatId: item.id,
                  chatName: getChatName(item, user?.uid),
                  isPinned: item.isPinned,
                  isMuted: item.isMuted,
                  mutedUntil: item.mutedUntil,
                  isArchived: item.isArchived,
                  isGroup: item.type === 'group',
                  members: item.members || [],
                  otherUserId: other?.id || null,
                });
              }}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="archive"
              title="No archived chats"
              message="Long-press any chat or open its settings to archive it."
            />
          }
          contentContainerStyle={[
            styles.listContent,
            chats.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
    ...SHADOWS.small,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...FONTS.h3, color: COLORS.text, flex: 1, textAlign: 'center' },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { flexGrow: 1, paddingTop: SIZES.sm, paddingBottom: SIZES.xl },
  emptyListContent: { justifyContent: 'center' },
});
