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
import { COLORS, FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { AppIcon } from '../../../components/AppIcon';
import { PRESS_FEEDBACK, PressableScale } from '../../../components/PressableScale';
import { SurfaceCard } from '../../../components/SurfaceCard';
import { UserAvatar } from '../../../components/UserAvatar';
import { useAuth } from '../../../context/AuthContext';
import { showErrorAlert } from '../../../utils/errorUtils';
import {
  MUTE_DURATIONS,
  clearChat,
  muteChat,
  toggleArchive,
  togglePin,
  unmuteChat,
} from '../services/chatSettingsService';
import { blockUser, reportUser } from '../../../services/blockService';
import { ReportSheet } from '../../../components/ReportSheet';
import { removeGroupMember, updateGroupChat } from '../../groups/services/groupService';

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
  } = route.params;

  const { user } = useAuth();
  const [pinned, setPinned] = useState(!!initialPinned);
  const [muted, setMuted] = useState(!!initialMuted);
  const [mutedUntil, setMutedUntil] = useState(initialMutedUntil || null);
  const [archived, setArchived] = useState(!!initialArchived);
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
              await blockUser(otherUserId);
              showToast('User blocked');
              navigation.goBack();
            } catch (error) {
              showErrorAlert(error, 'Could not block user.');
            } finally {
              setWorking(null);
            }
          },
        },
      ],
    );
  }, [navigation, otherUserId, working]);

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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
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
          <AppIcon name="arrow-left" size={22} color={COLORS.primary} />
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
                placeholderTextColor={COLORS.textLight}
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
                  <Divider />
                  <ActionRow
                    icon="save"
                    label="Save group name"
                    subtitle="Update the name for every member"
                    busy={working === 'group-save'}
                    onPress={handleGroupSave}
                  />
                  <Divider />
                  <ActionRow
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
                  {index > 0 ? <Divider /> : null}
                  <GroupMemberRow
                    member={member}
                    canManage={canManageGroup}
                    isSelf={member.id === user?.uid}
                    busy={working === `member-${member.id}`}
                    onRemove={() => handleRemoveMember(member)}
                  />
                </React.Fragment>
              ))}
            </SurfaceCard>
          </>
        ) : null}

        <SurfaceCard variant="strong" style={styles.card}>
          <ToggleRow
            icon="bookmark"
            title={pinned ? 'Pinned' : 'Pin chat'}
            subtitle={pinned ? 'Sticks to the top of your list' : 'Move this chat to the top'}
            value={pinned}
            busy={working === 'pin'}
            onPress={handlePinToggle}
          />
          <Divider />
          <ToggleRow
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
            icon="archive"
            title={archived ? 'Unarchive chat' : 'Archive chat'}
            subtitle={archived ? 'Move back to your active chats' : 'Hide from the main chat list'}
            value={archived}
            busy={working === 'archive'}
            onPress={handleArchiveToggle}
          />
          <Divider />
          <ActionRow
            icon="trash-2"
            label="Clear chat"
            subtitle="Hide all messages before now from your view"
            destructive
            busy={working === 'clear'}
            onPress={handleClear}
          />
        </SurfaceCard>

        {otherUserId ? (
          <SurfaceCard variant="strong" style={styles.card}>
            <ActionRow
              icon="slash"
              label="Block user"
              subtitle="Stop messages and friend requests from this person"
              destructive
              busy={working === 'block'}
              onPress={handleBlock}
            />
            <Divider />
            <ActionRow
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

function Divider() {
  return <View style={styles.divider} />;
}

function ToggleRow({ busy, icon, onPress, subtitle, title, value }) {
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
        <AppIcon name={icon} size={18} color={value ? COLORS.primary : COLORS.textSecondary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        <View style={[styles.toggle, value && styles.toggleOn]}>
          <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
        </View>
      )}
    </PressableScale>
  );
}

function ActionRow({ busy, destructive, icon, label, onPress, subtitle }) {
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
        <AppIcon name={icon} size={18} color={destructive ? COLORS.danger : COLORS.textSecondary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, destructive && styles.rowTitleDanger]}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {busy ? <ActivityIndicator size="small" color={COLORS.danger} /> : null}
    </PressableScale>
  );
}

function GroupMemberRow({ busy, canManage, isSelf, member, onRemove }) {
  const displayName = member.displayName || member.username || 'Blink User';
  const canRemove = isSelf || (canManage && member.role !== 'OWNER');

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
        <Text style={styles.memberRole} numberOfLines={1}>
          {(member.role || 'MEMBER').toLowerCase()}
        </Text>
      </View>
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
            <ActivityIndicator size="small" color={COLORS.danger} />
          ) : (
            <AppIcon
              name={isSelf ? 'log-out' : 'x'}
              size={17}
              color={isSelf ? COLORS.warning : COLORS.danger}
            />
          )}
        </PressableScale>
      ) : null}
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderStrong,
    backgroundColor: COLORS.backgroundSoft,
    ...SHADOWS.soft,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { ...FONTS.h3, color: COLORS.text, flex: 1, textAlign: 'center' },
  content: { padding: SIZES.md, paddingBottom: SIZES.xxl },
  card: { padding: SIZES.sm, marginBottom: SIZES.md, borderRadius: 18 },
  sectionLabel: {
    ...FONTS.small,
    color: COLORS.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
    paddingHorizontal: SIZES.sm,
    paddingTop: SIZES.xs,
  },
  sectionHint: {
    ...FONTS.small,
    color: COLORS.textSecondary,
    paddingHorizontal: SIZES.sm,
    paddingBottom: SIZES.sm,
  },
  groupInput: {
    ...FONTS.h3,
    minHeight: 50,
    color: COLORS.text,
    marginHorizontal: SIZES.sm,
    marginTop: SIZES.sm,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopColor: COLORS.highlight,
    backgroundColor: COLORS.inputBg,
  },
  groupInputDisabled: {
    color: COLORS.textSecondary,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: SIZES.sm,
  },
  memberCount: {
    ...FONTS.small,
    color: COLORS.textSecondary,
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
    color: COLORS.text,
  },
  memberRole: {
    ...FONTS.small,
    color: COLORS.textSecondary,
    marginTop: 1,
    textTransform: 'uppercase',
  },
  memberAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: SIZES.sm,
  },
  memberActionSelf: {
    backgroundColor: COLORS.warningLight,
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
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SIZES.sm + 4,
  },
  rowIconActive: { backgroundColor: COLORS.primaryLight },
  rowIconDanger: { backgroundColor: COLORS.dangerLight },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { ...FONTS.bodyBold, color: COLORS.text },
  rowTitleDanger: { color: COLORS.danger },
  rowSubtitle: { ...FONTS.small, color: COLORS.textSecondary, marginTop: 2 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceAlt,
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  toggleKnobOn: { transform: [{ translateX: 18 }] },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SIZES.sm },
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
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopColor: COLORS.highlight,
    marginRight: SIZES.xs,
    marginTop: SIZES.xs,
  },
  durationText: { ...FONTS.small, color: COLORS.textSecondary, fontWeight: '600' },
  footer: {
    ...FONTS.small,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SIZES.md,
  },
});
