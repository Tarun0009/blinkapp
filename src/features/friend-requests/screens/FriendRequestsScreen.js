import React, { useMemo } from 'react';
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
import { FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useFriendRequests } from '../hooks/useFriendRequests';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { FriendRequestCard } from '../components/FriendRequestCard';
import { AppIcon } from '../../../components/AppIcon';

export function FriendRequestsScreen({ navigation }) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const { incomingRequests, loading, acceptRequest, rejectRequest } = useFriendRequests(user?.uid);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={scheme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
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
          <AppIcon name="account-multiple-outline" size={22} color={colors.white} />
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
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
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
      height: 238,
      backgroundColor: colors.backgroundSoft,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
      backgroundColor: colors.surfaceGlass,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderTopColor: colors.highlight,
      ...SHADOWS.soft,
    },
    summaryIcon: {
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
    summaryCopy: {
      flex: 1,
      minWidth: 0,
    },
    summaryTitle: {
      ...FONTS.bodyBold,
      color: colors.text,
    },
    summaryText: {
      ...FONTS.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    countPill: {
      minWidth: 52,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 17,
      backgroundColor: colors.backgroundRaised,
      borderWidth: 1,
      borderColor: colors.border,
      marginLeft: SIZES.sm,
    },
    countValue: {
      ...FONTS.bodyBold,
      color: colors.primary,
    },
    countLabel: {
      ...FONTS.tiny,
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    loader: { flex: 1 },
    listContent: { flexGrow: 1, paddingBottom: SIZES.xl, paddingTop: SIZES.xs },
  });
}
