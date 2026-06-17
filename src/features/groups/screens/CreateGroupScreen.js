import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { SearchBar } from '../../../components/SearchBar';
import { AppIcon } from '../../../components/AppIcon';
import { COLORS, FONTS, SHADOWS, SIZES } from '../../../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { useChats } from '../../chats/hooks/useChats';
import { showErrorAlert } from '../../../utils/errorUtils';
import { GroupMemberPickerRow } from '../components/GroupMemberPickerRow';
import { createGroupChat } from '../services/groupService';

function getOtherDirectMember(chat, uid) {
  if (chat.type !== 'direct') {
    return null;
  }

  return chat.members?.find((member) => member.id !== uid) || null;
}

function buildConnectedPeople(chats, uid) {
  const peopleById = new Map();

  chats.forEach((chat) => {
    const person = getOtherDirectMember(chat, uid);
    if (person?.id) {
      peopleById.set(person.id, person);
    }
  });

  return Array.from(peopleById.values()).sort((a, b) =>
    (a.displayName || a.username || '').localeCompare(b.displayName || b.username || ''),
  );
}

function matchesSearch(person, search) {
  const term = search.trim().toLowerCase();
  if (!term) return true;

  return `${person.displayName || ''} ${person.username || ''}`
    .toLowerCase()
    .includes(term);
}

export function CreateGroupScreen({ navigation }) {
  const { user } = useAuth();
  const { chats, loading } = useChats(user?.uid);
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);

  const connectedPeople = useMemo(
    () => buildConnectedPeople(chats, user?.uid),
    [chats, user?.uid],
  );

  const filteredPeople = useMemo(
    () => connectedPeople.filter((person) => matchesSearch(person, search)),
    [connectedPeople, search],
  );

  const selectedCount = selectedIds.size;
  const canCreate = title.trim().length >= 2 && selectedCount > 0 && !submitting;

  const toggleMember = useCallback((personId) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Group name required', 'Give your group a clear name.');
      return;
    }

    if (selectedIds.size === 0) {
      Alert.alert('Select members', 'Choose at least one connected person.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = await createGroupChat({
        title: title.trim(),
        memberIds: Array.from(selectedIds),
      });
      const chat = payload?.chat;

      if (chat?.id) {
        navigation.replace('ChatRoom', {
          chatId: chat.id,
          chatName: chat.name || chat.title || title.trim(),
          isGroup: true,
          members: chat.members || [],
        });
      } else {
        navigation.goBack();
      }
    } catch (error) {
      showErrorAlert(error, 'Could not create group. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [navigation, selectedIds, title]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View pointerEvents="none" style={styles.topBand} />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          title="Create Group"
          subtitle={`${selectedCount} selected`}
          onBack={() => navigation.goBack()}
        />

        <View style={styles.formCard}>
          <View style={styles.formTop}>
            <View style={styles.formIcon}>
              <AppIcon name="users" size={20} color={COLORS.white} />
            </View>
            <View style={styles.formCopy}>
              <Text style={styles.label}>Group profile</Text>
              <Text style={styles.formTitle}>Name your space</Text>
            </View>
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeValue}>{selectedCount}</Text>
              <Text style={styles.selectedBadgeLabel}>picked</Text>
            </View>
          </View>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Weekend squad, project team..."
            placeholderTextColor={COLORS.textLight}
            maxLength={80}
            showSoftInputOnFocus
            style={styles.input}
          />
          <Text style={styles.helper}>
            Add people you are already connected with.
          </Text>
        </View>

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search connected people..."
          onClear={() => setSearch('')}
        />

        {loading && connectedPeople.length === 0 ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredPeople}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            removeClippedSubviews={false}
            renderItem={({ item }) => (
              <GroupMemberPickerRow
                person={item}
                selected={selectedIds.has(item.id)}
                onPress={() => toggleMember(item.id)}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon={search.trim() ? 'magnify' : 'users'}
                title={search.trim() ? 'No matching people' : 'No connected people yet'}
                message={
                  search.trim()
                    ? 'Try a different name or username.'
                    : 'Connect with someone first, then you can add them to a group.'
                }
                actionLabel={search.trim() ? 'Clear Search' : 'Find People'}
                onAction={
                  search.trim()
                    ? () => setSearch('')
                    : () => navigation.navigate('NewChat')
                }
              />
            }
            contentContainerStyle={[
              styles.listContent,
              filteredPeople.length === 0 && styles.emptyContent,
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={styles.footer}>
          <Button
            label={selectedCount > 0 ? `Create Group (${selectedCount + 1})` : 'Create Group'}
            icon="users"
            loading={submitting}
            disabled={!canCreate}
            onPress={handleCreate}
          />
        </View>
      </KeyboardAvoidingView>
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
    height: 290,
    backgroundColor: COLORS.backgroundSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  keyboard: {
    flex: 1,
  },
  formCard: {
    margin: SIZES.md,
    padding: SIZES.md,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderTopColor: COLORS.highlight,
    ...SHADOWS.soft,
  },
  formTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  formIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryDark,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginRight: SIZES.sm,
    ...SHADOWS.glow,
  },
  formCopy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...FONTS.small,
    color: COLORS.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  formTitle: {
    ...FONTS.bodyBold,
    color: COLORS.text,
    marginTop: 1,
  },
  selectedBadge: {
    minWidth: 54,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: COLORS.backgroundRaised,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginLeft: SIZES.sm,
  },
  selectedBadgeValue: {
    ...FONTS.bodyBold,
    color: COLORS.primary,
  },
  selectedBadgeLabel: {
    ...FONTS.tiny,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  input: {
    ...FONTS.h3,
    minHeight: 50,
    color: COLORS.text,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopColor: COLORS.highlight,
    backgroundColor: COLORS.inputBg,
  },
  helper: {
    ...FONTS.small,
    color: COLORS.textSecondary,
    marginTop: SIZES.sm,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: SIZES.xxl + SIZES.md,
  },
  emptyContent: {
    justifyContent: 'center',
  },
  footer: {
    padding: SIZES.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderStrong,
    backgroundColor: COLORS.backgroundSoft,
  },
});
