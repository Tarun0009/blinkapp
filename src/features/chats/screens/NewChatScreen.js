import React, { useState, useEffect, useCallback } from 'react';
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
import { COLORS, SIZES, FONTS, SHADOWS } from '../../../constants/theme';
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

export function NewChatScreen({ navigation }) {
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

    const outgoing = outgoingRequests.find((request) => request.receiverId === otherUserId);
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View pointerEvents="none" style={styles.topBand} />
      <ScreenHeader
        title="New Chat"
        subtitle="Find people to connect with"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.discoveryCard}>
        <View style={styles.discoveryIcon}>
          <AppIcon name="account-search-outline" size={22} color={COLORS.white} />
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
        <ActivityIndicator style={styles.loader} size="large" color={COLORS.primary} />
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
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            }
            renderItem={({ item }) => {
              const connectionState = getConnectionState(item.id);
              const displayName = getPublicName(item, 'Anonymous User');

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
                      <Text style={styles.userMeta} numberOfLines={1}>
                        {item.online
                          ? 'Available now'
                          : item.username
                            ? `@${item.username}`
                            : 'Blink member'}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    backgroundColor: COLORS.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.soft,
  },
  discoveryIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryDark,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginRight: SIZES.sm + 4,
    ...SHADOWS.glow,
  },
  discoveryCopy: {
    flex: 1,
    minWidth: 0,
  },
  discoveryTitle: {
    ...FONTS.bodyBold,
    color: COLORS.text,
  },
  discoveryText: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  discoveryPill: {
    minWidth: 54,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: SIZES.sm,
  },
  discoveryPillValue: {
    ...FONTS.bodyBold,
    color: COLORS.primary,
  },
  discoveryPillLabel: {
    ...FONTS.tiny,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  listHeader: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  listHeaderText: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceGlass,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    marginHorizontal: SIZES.md,
    marginVertical: SIZES.xs,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.soft,
  },
  userInfo: { flex: 1, marginLeft: SIZES.sm + 4 },
  userName: { ...FONTS.bodyBold, color: COLORS.text },
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
    backgroundColor: COLORS.online,
  },
  presenceDotOffline: {
    backgroundColor: COLORS.offline,
  },
  userMeta: { ...FONTS.caption, color: COLORS.textSecondary, flex: 1 },
  actionArea: { marginLeft: SIZES.sm },
});
