import React, { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
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
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={scheme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
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
          <AppIcon name="arrow-left" size={22} color={colors.primary} />
        </PressableScale>
        <Text style={styles.title}>Archived</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading && chats.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
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
                  isPinned: item.isPinned,
                  isMuted: item.isMuted,
                  mutedUntil: item.mutedUntil,
                  isArchived: item.isArchived,
                  isBlocked: item.isBlocked,
                  blockedByMe: item.blockedByMe,
                  blockedByUserId: item.blockedByUserId,
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
                  isBlocked: item.isBlocked,
                  blockedByMe: item.blockedByMe,
                  blockedByUserId: item.blockedByUserId,
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

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
      ...SHADOWS.small,
    },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { ...FONTS.h3, color: colors.text, flex: 1, textAlign: 'center' },
    loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: { flexGrow: 1, paddingTop: SIZES.sm, paddingBottom: SIZES.xl },
    emptyListContent: { justifyContent: 'center' },
  });
}
