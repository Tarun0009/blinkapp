import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { SurfaceCard } from '../../../components/SurfaceCard';
import { UserAvatar } from '../../../components/UserAvatar';
import { useAuth } from '../../../context/AuthContext';
import { showErrorAlert } from '../../../utils/errorUtils';
import { formatPresenceStatus } from '../../../utils/formatTime';
import {
  MUTE_DURATIONS,
  clearChat,
  muteChat,
  toggleArchive,
  togglePin,
  unmuteChat,
} from '../services/chatSettingsService';
import { blockUser, reportUser, unblockUser } from '../../profile/services/blockService';
import { ReportSheet } from '../../profile/components/ReportSheet';
import {
  removeGroupMember,
  updateGroupChat,
  updateGroupMemberRole,
} from '../../groups/services/groupService';

function showToast(message) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('', message);
  }
}

function formatMutedUntil(mutedUntil) {
  if (!mutedUntil) return null;
  const date = new Date(mutedUntil);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() - Date.now() > 90 * 24 * 60 * 60 * 1000) {
    return 'Muted until you turn it back on';
  }
  return `Muted until ${date.toLocaleString()}`;
}

export function ChatSettingsScreen({ route, navigation }) {
  const {
    chatId,
    chatName,
    isGroup = false,
    members = [],
    isPinned: initialPinned,
    isMuted: initialMuted,
    mutedUntil: initialMutedUntil,
    isArchived: initialArchived,
    otherUserId,
    isBlocked: initialBlocked = false,
    blockedByMe: initialBlockedByMe = false,
  } = route.params;

  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const [pinned, setPinned] = useState(!!initialPinned);
  const [muted, setMuted] = useState(!!initialMuted);
  const [mutedUntil, setMutedUntil] = useState(initialMutedUntil || null);
  const [archived, setArchived] = useState(!!initialArchived);
  const [blocked, setBlocked] = useState(!!initialBlocked);
  const [blockedByCurrentUser, setBlockedByCurrentUser] = useState(!!initialBlockedByMe);
  const [working, setWorking] = useState(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [groupTitle, setGroupTitle] = useState(chatName || '');
  const [groupMembers, setGroupMembers] = useState(members || []);

  const mutedLabel = useMemo(() => formatMutedUntil(mutedUntil), [mutedUntil]);
  const currentGroupMember = useMemo(
    () => groupMembers.find((member) => member.id === user?.uid),
    [groupMembers, user?.uid],
  );
  const canManageGroup =
    isGroup && ['OWNER', 'ADMIN'].includes(currentGroupMember?.role);
  const canManageRoles = isGroup && currentGroupMember?.role === 'OWNER';
  const blockStatusTitle = blockedByCurrentUser ? 'You blocked this user' : 'Messaging unavailable';
  const blockStatusMessage = blockedByCurrentUser
    ? `${chatName || 'This user'} cannot message you. You can unblock them anytime.`
    : 'You cannot send messages in this direct chat right now.';

  const handleGroupSave = useCallback(async () => {
    const nextTitle = groupTitle.trim();
    if (!nextTitle || nextTitle.length < 2) {
      Alert.alert('Group name required', 'Use at least 2 characters.');
      return;
    }

    if (working) return;
    setWorking('group-save');
    try {
      const payload = await updateGroupChat(chatId, { title: nextTitle });
      const chat = payload?.chat;
      if (chat?.members) {
        setGroupMembers(chat.members);
      }
      showToast('Group updated');
    } catch (error) {
      showErrorAlert(error, 'Could not update group.');
    } finally {
      setWorking(null);
    }
  }, [chatId, groupTitle, working]);

  const handleAddMembers = useCallback(() => {
    navigation.navigate('AddGroupMembers', {
      chatId,
      chatName: groupTitle.trim() || chatName,
      existingMemberIds: groupMembers.map((member) => member.id),
    });
  }, [chatId, chatName, groupMembers, groupTitle, navigation]);

  const handleRemoveMember = useCallback(
    (member) => {
      const isSelf = member.id === user?.uid;
      const title = isSelf ? 'Leave group?' : `Remove ${member.displayName || 'member'}?`;
      const message = isSelf
        ? 'You will stop receiving messages from this group.'
        : 'They will no longer see new group messages.';

      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isSelf ? 'Leave' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (working) return;
            setWorking(`member-${member.id}`);
            try {
              const payload = await removeGroupMember(chatId, member.id);
              setGroupMembers((current) =>
                current.filter((entry) => entry.id !== member.id),
              );
              if (isSelf || !payload) {
                navigation.popToTop();
              } else if (payload?.chat?.members) {
                setGroupMembers(payload.chat.members);
              }
              showToast(isSelf ? 'Left group' : 'Member removed');
            } catch (error) {
              showErrorAlert(error, isSelf ? 'Could not leave group.' : 'Could not remove member.');
            } finally {
              setWorking(null);
            }
          },
        },
      ]);
    },
    [chatId, navigation, user?.uid, working],
  );

  const handleToggleMemberRole = useCallback(
    async (member) => {
      if (working || member.role === 'OWNER') return;
      const nextRole = member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN';
      setWorking(`role-${member.id}`);
      try {
        const payload = await updateGroupMemberRole(chatId, member.id, nextRole);
        if (payload?.chat?.members) {
          setGroupMembers(payload.chat.members);
        } else {
          setGroupMembers((current) => current.map((entry) => (
            entry.id === member.id ? { ...entry, role: nextRole } : entry
          )));
        }
        showToast(nextRole === 'ADMIN' ? 'Admin added' : 'Admin removed');
      } catch (error) {
        showErrorAlert(error, 'Could not update admin role.');
      } finally {
        setWorking(null);
      }
    },
    [chatId, working],
  );
  const handlePinToggle = useCallback(async () => {
    if (working) return;
    setWorking('pin');
    try {
      const payload = await togglePin(chatId, !pinned);
      setPinned(!!payload?.preference?.isPinned);
      showToast(payload?.preference?.isPinned ? 'Chat pinned' : 'Chat unpinned');
    } catch (error) {
      showErrorAlert(error, 'Could not update pin.');
    } finally {
      setWorking(null);
    }
  }, [chatId, pinned, working]);

  const handleArchiveToggle = useCallback(async () => {
    if (working) return;
    setWorking('archive');
    try {
      const payload = await toggleArchive(chatId, !archived);
      const nextArchived = !!payload?.preference?.isArchived;
      setArchived(nextArchived);
      showToast(nextArchived ? 'Chat archived' : 'Chat unarchived');
      if (nextArchived) {
        navigation.goBack();
      }
    } catch (error) {
      showErrorAlert(error, 'Could not update archive.');
    } finally {
      setWorking(null);
    }
  }, [archived, chatId, navigation, working]);

  const handleMutePick = useCallback(
    async (duration) => {
      if (working) return;
      setWorking('mute');
      try {
        const payload = await muteChat(chatId, duration.ms);
        setMuted(!!payload?.preference?.isMuted);
        setMutedUntil(payload?.preference?.mutedUntil || null);
        showToast(`Muted ${duration.label.toLowerCase()}`);
      } catch (error) {
        showErrorAlert(error, 'Could not update mute.');
      } finally {
        setWorking(null);
      }
    },
    [chatId, working],
  );

  const handleUnmute = useCallback(async () => {
    if (working) return;
    setWorking('mute');
    try {
      const payload = await unmuteChat(chatId);
      setMuted(!!payload?.preference?.isMuted);
      setMutedUntil(payload?.preference?.mutedUntil || null);
      showToast('Notifications on');
    } catch (error) {
      showErrorAlert(error, 'Could not unmute.');
    } finally {
      setWorking(null);
    }
  }, [chatId, working]);

  const handleBlock = useCallback(() => {
    if (!otherUserId) return;
    Alert.alert(
      'Block user?',
      "You won't receive messages or friend requests from them.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            if (working) return;
            setWorking('block');
            try {
              const payload = await blockUser(otherUserId);
              setBlocked(true);
              setBlockedByCurrentUser(true);
              if (payload?.chat) {
                setBlocked(!!payload.chat.isBlocked);
                setBlockedByCurrentUser(!!payload.chat.blockedByMe);
              }
              showToast('User blocked');
            } catch (error) {
              showErrorAlert(error, 'Could not block user.');
            } finally {
              setWorking(null);
            }
          },
        },
      ],
    );
  }, [otherUserId, working]);

  const handleUnblock = useCallback(() => {
    if (!otherUserId) return;
    Alert.alert(
      'Unblock user?',
      `${chatName || 'This user'} will be able to message and connect with you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            if (working) return;
            setWorking('unblock');
            try {
              const payload = await unblockUser(otherUserId);
              setBlocked(!!payload?.chat?.isBlocked);
              setBlockedByCurrentUser(!!payload?.chat?.blockedByMe);
              showToast('User unblocked');
            } catch (error) {
              showErrorAlert(error, 'Could not unblock user.');
            } finally {
              setWorking(null);
            }
          },
        },
      ],
    );
  }, [chatName, otherUserId, working]);

  const handleReportSubmit = useCallback(
    async (reason, details) => {
      if (!otherUserId) return;
      try {
        await reportUser(otherUserId, reason, details);
        setReportVisible(false);
        showToast('Report sent');
      } catch (error) {
        showErrorAlert(error, 'Could not send report.');
      }
    },
    [otherUserId],
  );

  const handleClear = useCallback(() => {
    Alert.alert(
      'Clear chat?',
      'Messages before now will be hidden from your view. Other members will still see them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            if (working) return;
            setWorking('clear');
            try {
              await clearChat(chatId);
              showToast('Chat cleared');
              navigation.goBack();
            } catch (error) {
              showErrorAlert(error, 'Could not clear chat.');
            } finally {
              setWorking(null);
            }
          },
        },
      ],
    );
  }, [chatId, navigation, working]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={scheme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
      <View pointerEvents="none" style={styles.topBand} />
      <View style={styles.header}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          hitSlop={12}
          activeScale={0.9}
          borderless
          style={styles.headerBtn}>
          <AppIcon name="arrow-left" size={22} color={colors.primary} />
        </PressableScale>
        <Text style={styles.title} numberOfLines={1}>{chatName || 'Chat settings'}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}>
        {isGroup ? (
          <>
            <SurfaceCard variant="strong" style={styles.card}>
              <Text style={styles.sectionLabel}>Group profile</Text>
              <TextInput
                value={groupTitle}
                onChangeText={setGroupTitle}
                editable={canManageGroup}
                placeholder="Group name"
                placeholderTextColor={colors.textLight}
                maxLength={80}
                showSoftInputOnFocus
                style={[styles.groupInput, !canManageGroup && styles.groupInputDisabled]}
              />
              <Text style={styles.sectionHint}>
                {canManageGroup
                  ? 'Admins can rename this group and manage members.'
                  : 'Only group admins can edit group details.'}
              </Text>
              {canManageGroup ? (
                <>
                  <Divider styles={styles} />
                  <ActionRow
                    colors={colors}
                    styles={styles}
                    icon="save"
                    label="Save group name"
                    subtitle="Update the name for every member"
                    busy={working === 'group-save'}
                    onPress={handleGroupSave}
                  />
                  <Divider styles={styles} />
                  <ActionRow
                    colors={colors}
                    styles={styles}
                    icon="user-plus"
                    label="Add members"
                    subtitle="Invite connected people into this group"
                    onPress={handleAddMembers}
                  />
                </>
              ) : null}
            </SurfaceCard>

            <SurfaceCard variant="strong" style={styles.card}>
              <View style={styles.membersHeader}>
                <Text style={styles.sectionLabel}>Members</Text>
                <Text style={styles.memberCount}>
                  {groupMembers.length} member{groupMembers.length === 1 ? '' : 's'}
                </Text>
              </View>
              {groupMembers.map((member, index) => (
                <React.Fragment key={member.id}>
                  {index > 0 ? <Divider styles={styles} /> : null}
                  <GroupMemberRow
                    colors={colors}
                    styles={styles}
                    member={member}
                    canManage={canManageGroup}
                    canManageRoles={canManageRoles}
                    isSelf={member.id === user?.uid}
                    busy={working === `member-${member.id}`}
                    roleBusy={working === `role-${member.id}`}
                    onRemove={() => handleRemoveMember(member)}
                    onToggleRole={() => handleToggleMemberRole(member)}
                  />
                </React.Fragment>
              ))}
            </SurfaceCard>
          </>
        ) : null}

        <SurfaceCard variant="strong" style={styles.card}>
          <ToggleRow
            colors={colors}
            styles={styles}
            icon="bookmark"
            title={pinned ? 'Pinned' : 'Pin chat'}
            subtitle={pinned ? 'Sticks to the top of your list' : 'Move this chat to the top'}
            value={pinned}
            busy={working === 'pin'}
            onPress={handlePinToggle}
          />
          <Divider styles={styles} />
          <ToggleRow
            colors={colors}
            styles={styles}
            icon={muted ? 'bell-off' : 'bell'}
            title={muted ? 'Muted' : 'Mute notifications'}
            subtitle={muted ? mutedLabel || 'Muted' : 'Stop badges and (later) push pings for this chat'}
            value={muted}
            busy={working === 'mute'}
            onPress={muted ? handleUnmute : null}
          />
          {!muted ? (
            <View style={styles.durations}>
              {MUTE_DURATIONS.map((option) => (
                <PressableScale
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityLabel={`Mute for ${option.label}`}
                  activeScale={0.95}
                  activeOpacity={0.82}
                  rippleColor={PRESS_FEEDBACK.softRipple}
                  style={styles.durationChip}
                  onPress={() => handleMutePick(option)}>
                  <Text style={styles.durationText}>{option.label}</Text>
                </PressableScale>
              ))}
            </View>
          ) : null}
        </SurfaceCard>

        <SurfaceCard variant="strong" style={styles.card}>
          <ToggleRow
            colors={colors}
            styles={styles}
            icon="archive"
            title={archived ? 'Unarchive chat' : 'Archive chat'}
            subtitle={archived ? 'Move back to your active chats' : 'Hide from the main chat list'}
            value={archived}
            busy={working === 'archive'}
            onPress={handleArchiveToggle}
          />
          <Divider styles={styles} />
          <ActionRow
            colors={colors}
            styles={styles}
            icon="trash-2"
            label="Clear chat"
            subtitle="Hide all messages before now from your view"
            destructive
            busy={working === 'clear'}
            onPress={handleClear}
          />
        </SurfaceCard>

        {otherUserId && blocked ? (
          <SurfaceCard variant="strong" style={styles.card}>
            <View style={styles.blockStatusRow}>
              <View style={styles.blockStatusIcon}>
                <AppIcon name="slash" size={18} color={colors.danger} />
              </View>
              <View style={styles.blockStatusBody}>
                <Text style={styles.blockStatusTitle}>{blockStatusTitle}</Text>
                <Text style={styles.blockStatusMessage}>{blockStatusMessage}</Text>
              </View>
            </View>
          </SurfaceCard>
        ) : null}

        {otherUserId ? (
          <SurfaceCard variant="strong" style={styles.card}>
            <ActionRow
              colors={colors}
              styles={styles}
              icon={blockedByCurrentUser ? 'unlock' : 'slash'}
              label={blockedByCurrentUser ? 'Unblock user' : 'Block user'}
              subtitle={
                blockedByCurrentUser
                  ? 'Allow messages and requests from this person again'
                  : blocked
                    ? 'You can also block this person from contacting you'
                    : 'Stop messages and friend requests from this person'
              }
              destructive={!blockedByCurrentUser}
              busy={working === 'block' || working === 'unblock'}
              onPress={blockedByCurrentUser ? handleUnblock : handleBlock}
            />
            <Divider styles={styles} />
            <ActionRow
              colors={colors}
              styles={styles}
              icon="flag"
              label="Report user"
              subtitle="Send to moderation for review"
              onPress={() => setReportVisible(true)}
            />
          </SurfaceCard>
        ) : null}

        <Text style={styles.footer}>
          Mute, archive, and clear are personal — they only change what you see.
        </Text>
      </ScrollView>

      <ReportSheet
        visible={reportVisible}
        targetName={chatName}
        onClose={() => setReportVisible(false)}
        onSubmit={handleReportSubmit}
      />
    </SafeAreaView>
  );
}

function Divider({ styles }) {
  return <View style={styles.divider} />;
}

function ToggleRow({ busy, colors, styles, icon, onPress, subtitle, title, value }) {
  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value }}
      accessibilityLabel={title}
      activeScale={0.99}
      activeOpacity={0.92}
      rippleColor={PRESS_FEEDBACK.softRipple}
      style={styles.row}
      disabled={!onPress || busy}
      onPress={onPress}>
      <View style={[styles.rowIcon, value && styles.rowIconActive]}>
        <AppIcon name={icon} size={18} color={value ? colors.primary : colors.textSecondary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <View style={[styles.toggle, value && styles.toggleOn]}>
          <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
        </View>
      )}
    </PressableScale>
  );
}

function ActionRow({ busy, colors, styles, destructive, icon, label, onPress, subtitle }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      activeScale={0.99}
      activeOpacity={0.9}
      rippleColor={destructive ? PRESS_FEEDBACK.dangerRipple : PRESS_FEEDBACK.softRipple}
      style={styles.row}
      disabled={busy}
      onPress={onPress}>
      <View style={[styles.rowIcon, destructive && styles.rowIconDanger]}>
        <AppIcon name={icon} size={18} color={destructive ? colors.danger : colors.textSecondary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, destructive && styles.rowTitleDanger]}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {busy ? <ActivityIndicator size="small" color={colors.danger} /> : null}
    </PressableScale>
  );
}

function GroupMemberRow({
  busy,
  canManage,
  canManageRoles,
  colors,
  styles,
  isSelf,
  member,
  onRemove,
  onToggleRole,
  roleBusy,
}) {
  const displayName = member.displayName || member.username || 'Blink User';
  const memberRole = member.role || 'MEMBER';
  const canRemove = isSelf || (canManage && memberRole !== 'OWNER');
  const canChangeRole = canManageRoles && !isSelf && memberRole !== 'OWNER';
  const roleLabel = memberRole.toLowerCase();
  const nextRoleLabel = memberRole === 'ADMIN' ? 'Remove admin' : 'Make admin';
  const presenceLabel = formatPresenceStatus({
    online: member.online,
    lastSeen: member.lastSeenAt,
  });

  return (
    <View style={styles.memberRow}>
      <UserAvatar
        photoURL={member.photoURL}
        name={displayName}
        size={42}
        online={member.online}
      />
      <View style={styles.memberBody}>
        <Text style={styles.memberName} numberOfLines={1}>
          {isSelf ? `${displayName} (You)` : displayName}
        </Text>
        <Text style={[styles.memberRole, member.online && styles.memberRoleOnline]} numberOfLines={1}>
          {`${roleLabel} · ${presenceLabel}`}
        </Text>
      </View>
      <View style={styles.memberActions}>
        {canChangeRole ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${nextRoleLabel} ${displayName}`}
            activeScale={0.92}
            activeOpacity={0.82}
            disabled={roleBusy}
            rippleColor={PRESS_FEEDBACK.softRipple}
            style={[
              styles.memberAction,
              styles.memberRoleAction,
              memberRole === 'ADMIN' && styles.memberRoleActionActive,
            ]}
            onPress={onToggleRole}>
            {roleBusy ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <AppIcon
                name={memberRole === 'ADMIN' ? 'shield' : 'user-check'}
                size={17}
                color={memberRole === 'ADMIN' ? colors.primary : colors.textSecondary}
              />
            )}
          </PressableScale>
        ) : null}
        {canRemove ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={isSelf ? 'Leave group' : `Remove ${displayName}`}
            activeScale={0.92}
            activeOpacity={0.82}
            disabled={busy}
            rippleColor={PRESS_FEEDBACK.dangerRipple}
            style={[styles.memberAction, isSelf && styles.memberActionSelf]}
            onPress={onRemove}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <AppIcon
                name={isSelf ? 'log-out' : 'x'}
                size={17}
                color={isSelf ? colors.warning : colors.danger}
              />
            )}
          </PressableScale>
        ) : null}
      </View>
    </View>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm + 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderStrong,
      backgroundColor: colors.backgroundSoft,
      ...SHADOWS.soft,
    },
    headerBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: { ...FONTS.h3, color: colors.text, flex: 1, textAlign: 'center' },
    content: { padding: SIZES.md, paddingBottom: SIZES.xxl },
    card: { padding: SIZES.sm, marginBottom: SIZES.md, borderRadius: 18 },
    blockStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.sm,
      paddingVertical: SIZES.sm + 2,
    },
    blockStatusIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.dangerLight,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: SIZES.sm + 2,
    },
    blockStatusBody: { flex: 1, minWidth: 0 },
    blockStatusTitle: {
      ...FONTS.bodyBold,
      color: colors.danger,
    },
    blockStatusMessage: {
      ...FONTS.small,
      color: colors.textSecondary,
      marginTop: 2,
    },
    sectionLabel: {
      ...FONTS.small,
      color: colors.primary,
      fontWeight: '800',
      textTransform: 'uppercase',
      paddingHorizontal: SIZES.sm,
      paddingTop: SIZES.xs,
    },
    sectionHint: {
      ...FONTS.small,
      color: colors.textSecondary,
      paddingHorizontal: SIZES.sm,
      paddingBottom: SIZES.sm,
    },
    groupInput: {
      ...FONTS.h3,
      minHeight: 50,
      color: colors.text,
      marginHorizontal: SIZES.sm,
      marginTop: SIZES.sm,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopColor: colors.highlight,
      backgroundColor: colors.inputBg,
    },
    groupInputDisabled: {
      color: colors.textSecondary,
    },
    membersHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: SIZES.sm,
    },
    memberCount: {
      ...FONTS.small,
      color: colors.textSecondary,
      fontWeight: '800',
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.sm,
      paddingVertical: SIZES.sm + 3,
    },
    memberBody: {
      flex: 1,
      minWidth: 0,
      marginLeft: SIZES.sm + 2,
    },
    memberName: {
      ...FONTS.bodyBold,
      color: colors.text,
    },
    memberRole: {
      ...FONTS.small,
      color: colors.textSecondary,
      marginTop: 1,
    },
    memberRoleOnline: {
      color: colors.online,
      fontWeight: '700',
    },
    memberActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: SIZES.sm,
    },
    memberAction: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.dangerLight,
      borderWidth: 1,
      borderColor: colors.border,
      marginLeft: SIZES.sm,
    },
    memberActionSelf: {
      backgroundColor: colors.warningLight,
    },
    memberRoleAction: {
      backgroundColor: colors.surfaceGlass,
      marginLeft: 0,
      marginRight: SIZES.xs,
    },
    memberRoleActionActive: {
      backgroundColor: colors.primaryLight,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.sm,
      paddingVertical: SIZES.sm + 4,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundRaised,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: SIZES.sm + 4,
    },
    rowIconActive: { backgroundColor: colors.primaryLight },
    rowIconDanger: { backgroundColor: colors.dangerLight },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { ...FONTS.bodyBold, color: colors.text },
    rowTitleDanger: { color: colors.danger },
    rowSubtitle: { ...FONTS.small, color: colors.textSecondary, marginTop: 2 },
    toggle: {
      width: 44,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.surfaceAlt,
      padding: 3,
      justifyContent: 'center',
    },
    toggleOn: { backgroundColor: colors.primary },
    toggleKnob: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.white,
      ...SHADOWS.small,
    },
    toggleKnobOn: { transform: [{ translateX: 18 }] },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: SIZES.sm },
    durations: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: SIZES.sm + 36 + SIZES.sm,
      paddingBottom: SIZES.sm,
    },
    durationChip: {
      paddingHorizontal: SIZES.sm + 2,
      paddingVertical: SIZES.xs + 2,
      borderRadius: 14,
      backgroundColor: colors.surfaceGlass,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopColor: colors.highlight,
      marginRight: SIZES.xs,
      marginTop: SIZES.xs,
    },
    durationText: { ...FONTS.small, color: colors.textSecondary, fontWeight: '600' },
    footer: {
      ...FONTS.small,
      color: colors.textLight,
      textAlign: 'center',
      marginTop: SIZES.md,
    },
  });
}





