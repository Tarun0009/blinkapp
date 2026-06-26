import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { SearchBar } from '../../../components/SearchBar';
import { SIZES } from '../../../constants/theme';
import { useTheme } from '../../../theme/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useChats } from '../../chats/hooks/useChats';
import { showErrorAlert } from '../../../utils/errorUtils';
import { GroupMemberPickerRow } from '../components/GroupMemberPickerRow';
import { addGroupMembers } from '../services/groupService';

function getOtherDirectMember(chat, uid) {
  if (chat.type !== 'direct') {
    return null;
  }

  return chat.members?.find((member) => member.id !== uid) || null;
}

function buildAddablePeople(chats, uid, existingMemberIds) {
  const existing = new Set(existingMemberIds || []);
  const peopleById = new Map();

  chats.forEach((chat) => {
    const person = getOtherDirectMember(chat, uid);
    if (person?.id && !existing.has(person.id)) {
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

export function AddGroupMembersScreen({ route, navigation }) {
  const { chatId, chatName, existingMemberIds = [] } = route.params;
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();
  const { chats, loading } = useChats(user?.uid);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);

  const addablePeople = useMemo(
    () => buildAddablePeople(chats, user?.uid, existingMemberIds),
    [chats, existingMemberIds, user?.uid],
  );

  const filteredPeople = useMemo(
    () => addablePeople.filter((person) => matchesSearch(person, search)),
    [addablePeople, search],
  );

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

  const handleAdd = useCallback(async () => {
    if (selectedIds.size === 0) {
      Alert.alert('Select members', 'Choose at least one person to add.');
      return;
    }

    setSubmitting(true);
    try {
      await addGroupMembers(chatId, Array.from(selectedIds));
      Alert.alert('Members added', 'The group has been updated.');
      navigation.goBack();
    } catch (error) {
      showErrorAlert(error, 'Could not add members. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [chatId, navigation, selectedIds]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={scheme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
      <ScreenHeader
        title="Add Members"
        subtitle={chatName || 'Group chat'}
        onBack={() => navigation.goBack()}
      />

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search connected people..."
        onClear={() => setSearch('')}
      />

      {loading && addablePeople.length === 0 ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
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
              title={search.trim() ? 'No matching people' : 'No one to add'}
              message={
                search.trim()
                  ? 'Try a different name or username.'
                  : 'Everyone you are connected with is already in this group.'
              }
              actionLabel={search.trim() ? 'Clear Search' : undefined}
              onAction={search.trim() ? () => setSearch('') : undefined}
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
          label={
            selectedIds.size > 0
              ? `Add ${selectedIds.size} Member${selectedIds.size === 1 ? '' : 's'}`
              : 'Add Members'
          }
          icon="user-plus"
          loading={submitting}
          disabled={selectedIds.size === 0 || submitting}
          onPress={handleAdd}
        />
      </View>
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
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
  });
}
