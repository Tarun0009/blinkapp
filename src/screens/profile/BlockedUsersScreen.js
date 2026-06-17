import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS, FONTS, SHADOWS, SIZES } from '../../constants/theme';
import { AppIcon } from '../../components/AppIcon';
import { EmptyState } from '../../components/EmptyState';
import { PRESS_FEEDBACK, PressableScale } from '../../components/PressableScale';
import { UserAvatar } from '../../components/UserAvatar';
import { fetchBlockedUsers, unblockUser } from '../../services/blockService';
import { showErrorAlert } from '../../utils/errorUtils';

export function BlockedUsersScreen({ navigation }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingId, setUnblockingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const list = await fetchBlockedUsers();
      setBlocks(list);
    } catch (error) {
      showErrorAlert(error, 'Could not load blocked users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnblock = useCallback(
    (block) => {
      Alert.alert(
        'Unblock user?',
        `${block.user.displayName || 'This user'} will be able to message and connect with you again.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            style: 'destructive',
            onPress: async () => {
              setUnblockingId(block.user.id);
              try {
                await unblockUser(block.user.id);
                setBlocks((current) => current.filter((entry) => entry.user.id !== block.user.id));
              } catch (error) {
                showErrorAlert(error, 'Could not unblock user.');
              } finally {
                setUnblockingId(null);
              }
            },
          },
        ],
      );
    },
    [],
  );

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
          rippleColor={PRESS_FEEDBACK.softRipple}
          style={styles.headerBtn}>
          <AppIcon name="arrow-left" size={22} color={COLORS.primary} />
        </PressableScale>
        <Text style={styles.title}>Blocked users</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading && blocks.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={blocks}
          keyExtractor={(item) => item.user.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <UserAvatar photoURL={item.user.photoURL} name={item.user.displayName} size={42} />
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.user.displayName || 'Blink user'}
                </Text>
                {item.user.username ? (
                  <Text style={styles.username}>{`@${item.user.username}`}</Text>
                ) : null}
              </View>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${item.user.displayName || 'user'}`}
                activeScale={0.94}
                activeOpacity={0.86}
                rippleColor={PRESS_FEEDBACK.dangerRipple}
                style={styles.unblockBtn}
                disabled={unblockingId === item.user.id}
                onPress={() => handleUnblock(item)}>
                {unblockingId === item.user.id ? (
                  <ActivityIndicator size="small" color={COLORS.danger} />
                ) : (
                  <Text style={styles.unblockText}>Unblock</Text>
                )}
              </PressableScale>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="shield"
              title="No one is blocked"
              message="If you block someone, they show up here so you can unblock later."
            />
          }
          contentContainerStyle={[
            styles.listContent,
            blocks.length === 0 && styles.emptyListContent,
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
  topBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 228,
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
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...FONTS.h3, color: COLORS.text, flex: 1, textAlign: 'center' },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { flexGrow: 1, paddingTop: SIZES.sm, paddingBottom: SIZES.xl },
  emptyListContent: { justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm + 2,
    marginHorizontal: SIZES.md,
    marginVertical: SIZES.xs,
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.soft,
  },
  body: { flex: 1, minWidth: 0, marginLeft: SIZES.sm + 4 },
  name: { ...FONTS.bodyBold, color: COLORS.text },
  username: { ...FONTS.small, color: COLORS.textSecondary, marginTop: 2 },
  unblockBtn: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs + 2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerLight,
  },
  unblockText: { ...FONTS.small, color: COLORS.danger, fontWeight: '700' },
});
