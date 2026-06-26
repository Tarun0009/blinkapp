import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { SIZES, FONTS, SHADOWS } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useChats } from '../hooks/useChats';
import { useFriendRequests } from '../../friend-requests/hooks/useFriendRequests';
import { UserConnectionAction } from '../../friend-requests/components/UserConnectionAction';
import { loadConnectableUsers } from '../../../services/userDirectoryService';
import { UserAvatar } from '../../../components/UserAvatar';
import { SearchBar } from '../../../components/SearchBar';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { AppIcon } from '../../../components/AppIcon';
import { getPublicErrorMessage, showErrorAlert } from '../../../utils/errorUtils';
import { formatPresenceStatus } from '../../../utils/formatTime';
import { realtimeClient } from '../../../realtime/socketClient';
import { SOCKET_EVENTS } from '../../../realtime/socketEvents';

export function NewChatScreen({ navigation }) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, userProfile } = useAuth();
  const { chats } = useChats(user?.uid);
  const {
    acceptRequest,
    incomingRequests,
    rejectRequest,
    sendRequest,
    outgoingRequests,
  } = useFriendRequests(user?.uid);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [requestingId, setRequestingId] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [loadError, setLoadError] = useState('');

  const getPublicName = useCallback((person, fallback = 'Blink User') => {
    const name = person?.displayName?.trim();
    if (name) return name;

    const username = person?.username?.trim();
    if (username) return `@${username}`;

    return fallback;
  }, []);

  const loadUsers = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const list = (await loadConnectableUsers(user.uid)).filter((u) => u.id !== user.uid);

      setUsers(list);
      setLoadError('');
    } catch (error) {
      const message = getPublicErrorMessage(
        error,
        'Unable to load people right now. Please try again.',
      );
      setLoadError(message);
      showErrorAlert(error, message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const handlePresence = (payload = {}) => {
      const targetId = payload.userId || payload.uid;
      if (!targetId) return;

      const lastSeenValue = payload.lastSeen || payload.lastSeenAt;
      setUsers((current) =>
        current.map((person) =>
          person.id === targetId
            ? {
                ...person,
                online: Boolean(payload.online),
                lastSeenAt: payload.online ? person.lastSeenAt : lastSeenValue || person.lastSeenAt,
              }
            : person,
        ),
      );
    };

    const unsubscribeOnline = realtimeClient.on(SOCKET_EVENTS.PRESENCE_ONLINE, handlePresence);
    const unsubscribeOffline = realtimeClient.on(SOCKET_EVENTS.PRESENCE_OFFLINE, handlePresence);

    return () => {
      unsubscribeOnline();
      unsubscribeOffline();
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const handleConnect = async (otherUser) => {
    if (requestingId || acceptingId || rejectingId) return;
    setRequestingId(otherUser.id);
    try {
      await sendRequest(otherUser, userProfile);
      Alert.alert('Success', `Connect request sent to ${getPublicName(otherUser)}!`);
    } catch (error) {
      showErrorAlert(error, 'Unable to send request. Please try again.');
    } finally {
      setRequestingId(null);
    }
  };

  const handleAcceptIncoming = async (request, otherUser) => {
    if (requestingId || acceptingId || rejectingId) return;
    setAcceptingId(otherUser.id);
    try {
      const payload = await acceptRequest(request);
      const chat = payload?.chat;

      if (chat?.id) {
        navigation.replace('ChatRoom', {
          chatId: chat.id,
          chatName: getPublicName(otherUser, request.senderName || 'Chat'),
          isGroup: false,
          members: chat.members || [],
          otherUserId: otherUser.id,
          isPinned: chat.isPinned,
          isMuted: chat.isMuted,
          mutedUntil: chat.mutedUntil,
          isArchived: chat.isArchived,
          isBlocked: chat.isBlocked,
          blockedByMe: chat.blockedByMe,
          blockedByUserId: chat.blockedByUserId,
        });
      } else {
        Alert.alert(
          'Connected',
          `You are now connected with ${getPublicName(otherUser)}.`,
        );
      }
    } catch (error) {
      showErrorAlert(error, 'Unable to accept request. Please try again.');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleRejectIncoming = async (request, otherUser) => {
    if (requestingId || acceptingId || rejectingId) return;

    Alert.alert(
      'Reject Request',
      `Reject ${getPublicName(otherUser, request.senderName)}'s request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setRejectingId(otherUser.id);
            try {
              await rejectRequest(request.id);
            } catch (error) {
              showErrorAlert(error, 'Unable to reject request. Please try again.');
            } finally {
              setRejectingId(null);
            }
          },
        },
      ],
    );
  };

  const getConnectionState = (otherUserId) => {
    const directChat = chats.find(
      (chat) =>
        chat.type === 'direct' &&
        chat.members?.some((member) => member.id === otherUserId),
    );

    if (directChat) {
      return { type: 'connected', status: 'accepted', chat: directChat };
    }

    const incoming = incomingRequests.find(
      (request) => request.senderId === otherUserId && request.status === 'pending',
    );

    if (incoming) {
      return { type: 'incoming', request: incoming };
    }

    const outgoing = outgoingRequests.find(
      (request) => request.receiverId === otherUserId && request.status === 'pending',
    );
    if (outgoing) {
      return { type: 'outgoing', status: outgoing.status };
    }

    return { type: 'none' };
  };

  const filtered = search
    ? users.filter((u) => {
        const name = `${u.displayName || ''} ${u.username || ''}`;
        return name.toLowerCase().includes(search.toLowerCase());
      })
    : users;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={scheme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
      <View pointerEvents="none" style={styles.topBand} />
      <ScreenHeader
        title="New Chat"
        subtitle="Find people to connect with"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.discoveryCard}>
        <View style={styles.discoveryIcon}>
          <AppIcon name="account-search-outline" size={22} color={colors.white} />
        </View>
        <View style={styles.discoveryCopy}>
          <Text style={styles.discoveryTitle}>Discover people</Text>
          <Text style={styles.discoveryText} numberOfLines={2}>
            Send a connection request before starting a private chat.
          </Text>
        </View>
        <View style={styles.discoveryPill}>
          <Text style={styles.discoveryPillValue}>{users.length}</Text>
          <Text style={styles.discoveryPillLabel}>users</Text>
        </View>
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search users..."
        onClear={() => setSearch('')}
      />

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>
              {filtered.length === 1 ? '1 person available' : `${filtered.length} people available`}
            </Text>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            renderItem={({ item }) => {
              const connectionState = getConnectionState(item.id);
              const displayName = getPublicName(item, 'Anonymous User');
              const presenceLabel = formatPresenceStatus({
                online: item.online,
                lastSeen: item.lastSeenAt,
              });

              return (
                <View style={styles.userRow}>
                  <UserAvatar
                    photoURL={item.photoURL}
                    name={displayName}
                    size={44}
                    online={item.online}
                  />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{displayName}</Text>
                    <View style={styles.userMetaRow}>
                      <View
                        style={[
                          styles.presenceDot,
                          item.online ? styles.presenceDotOnline : styles.presenceDotOffline,
                        ]}
                      />
                      <Text style={[styles.userMeta, item.online && styles.userMetaOnline]} numberOfLines={1}>
                        {presenceLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionArea}>
                    <UserConnectionAction
                      connectionState={connectionState}
                      displayName={displayName}
                      isAccepting={acceptingId === item.id}
                      isRejecting={rejectingId === item.id}
                      isRequesting={requestingId === item.id}
                      onAccept={() => handleAcceptIncoming(connectionState.request, item)}
                      onConnect={() => handleConnect(item)}
                      onReject={() => handleRejectIncoming(connectionState.request, item)}
                    />
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <EmptyState
                icon={loadError ? 'cloud-alert-outline' : 'account-search-outline'}
                title={loadError ? 'Cannot load users' : 'No people found'}
                message={loadError || 'Try another search, or create another test account.'}
                actionLabel="Refresh"
                onAction={handleRefresh}
              />
            }
            contentContainerStyle={styles.listContent}
          />
        </>
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
    topBand: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 260,
      backgroundColor: colors.backgroundSoft,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    loader: { flex: 1 },
    listContent: { flexGrow: 1, paddingBottom: SIZES.xl },
    discoveryCard: {
      minHeight: 88,
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: SIZES.md,
      marginTop: SIZES.md,
      marginBottom: SIZES.sm,
      padding: SIZES.md,
      borderRadius: 22,
      backgroundColor: colors.surfaceGlass,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderTopColor: colors.highlight,
      ...SHADOWS.soft,
    },
    discoveryIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryDark,
      borderWidth: 1,
      borderColor: colors.primary,
      marginRight: SIZES.sm + 4,
      ...SHADOWS.glow,
    },
    discoveryCopy: {
      flex: 1,
      minWidth: 0,
    },
    discoveryTitle: {
      ...FONTS.bodyBold,
      color: colors.text,
    },
    discoveryText: {
      ...FONTS.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    discoveryPill: {
      minWidth: 54,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 17,
      backgroundColor: colors.backgroundRaised,
      borderWidth: 1,
      borderColor: colors.border,
      marginLeft: SIZES.sm,
    },
    discoveryPillValue: {
      ...FONTS.bodyBold,
      color: colors.primary,
    },
    discoveryPillLabel: {
      ...FONTS.tiny,
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    listHeader: {
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
      backgroundColor: 'transparent',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    listHeaderText: {
      ...FONTS.caption,
      color: colors.textSecondary,
      fontWeight: 'bold',
      textTransform: 'uppercase',
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceGlass,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.md,
      marginHorizontal: SIZES.md,
      marginVertical: SIZES.xs,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderTopColor: colors.highlight,
      ...SHADOWS.soft,
    },
    userInfo: { flex: 1, marginLeft: SIZES.sm + 4 },
    userName: { ...FONTS.bodyBold, color: colors.text },
    userMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
    },
    presenceDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginRight: SIZES.xs,
    },
    presenceDotOnline: {
      backgroundColor: colors.online,
    },
    presenceDotOffline: {
      backgroundColor: colors.offline,
    },
    userMeta: { ...FONTS.caption, color: colors.textSecondary, flex: 1 },
    userMetaOnline: { color: colors.online, fontWeight: '700' },
    actionArea: { marginLeft: SIZES.sm },
  });
}
