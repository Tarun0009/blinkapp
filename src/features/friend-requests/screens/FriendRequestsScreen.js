import React from 'react';
import {
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  Text,
  View,
} from 'react-native';
import { COLORS, FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { useFriendRequests } from '../hooks/useFriendRequests';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { FriendRequestCard } from '../components/FriendRequestCard';
import { AppIcon } from '../../../components/AppIcon';

export function FriendRequestsScreen({ navigation }) {
  const { user } = useAuth();
  const { incomingRequests, loading, acceptRequest, rejectRequest } = useFriendRequests(user?.uid);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View pointerEvents="none" style={styles.topBand} />
      <ScreenHeader
        title="Requests"
        subtitle={
          incomingRequests.length === 1
            ? '1 pending request'
            : `${incomingRequests.length} pending requests`
        }
        onBack={() => navigation.goBack()}
      />

      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <AppIcon name="account-multiple-outline" size={22} color={COLORS.white} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>Connection requests</Text>
          <Text style={styles.summaryText} numberOfLines={2}>
            Accept people you know before they can start a chat with you.
          </Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countValue}>{incomingRequests.length}</Text>
          <Text style={styles.countLabel}>new</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={COLORS.primary} />
      ) : (
        <FlatList
          data={incomingRequests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FriendRequestCard
              request={item}
              onAccept={acceptRequest}
              onReject={rejectRequest}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="account-check-outline"
              title="No pending requests"
              message="New connection requests will appear here."
            />
          }
          contentContainerStyle={styles.listContent}
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
    height: 238,
    backgroundColor: COLORS.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SIZES.md,
    marginTop: SIZES.md,
    marginBottom: SIZES.xs,
    padding: SIZES.md,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.soft,
  },
  summaryIcon: {
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
  summaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  summaryTitle: {
    ...FONTS.bodyBold,
    color: COLORS.text,
  },
  summaryText: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  countPill: {
    minWidth: 52,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: SIZES.sm,
  },
  countValue: {
    ...FONTS.bodyBold,
    color: COLORS.primary,
  },
  countLabel: {
    ...FONTS.tiny,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  loader: { flex: 1 },
  listContent: { flexGrow: 1, paddingBottom: SIZES.xl, paddingTop: SIZES.xs },
});
