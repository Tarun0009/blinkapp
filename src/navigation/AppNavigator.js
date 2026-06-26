import React, { useMemo } from 'react';
import { DefaultTheme, DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { usePresence } from '../hooks/usePresence';
import { AppTabBar } from '../components/AppTabBar';
import { navigationRef } from './navigationRef';

import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { SignupScreen } from '../features/auth/screens/SignupScreen';
import { ForgotPasswordScreen } from '../features/auth/screens/ForgotPasswordScreen';
import { SplashScreen } from '../features/auth/screens/SplashScreen';
import { ChatListScreen } from '../features/chats/screens/ChatListScreen';
import { ChatRoomScreen } from '../features/chats/screens/ChatRoomScreen';
import { NewChatScreen } from '../features/chats/screens/NewChatScreen';
import { ChatSettingsScreen } from '../features/chats/screens/ChatSettingsScreen';
import { ArchivedChatsScreen } from '../features/chats/screens/ArchivedChatsScreen';
import { MessageSearchScreen } from '../features/chats/screens/MessageSearchScreen';
import { FriendRequestsScreen } from '../features/friend-requests/screens/FriendRequestsScreen';
import { AddGroupMembersScreen } from '../features/groups/screens/AddGroupMembersScreen';
import { CreateGroupScreen } from '../features/groups/screens/CreateGroupScreen';
import { ProfileScreen } from '../features/profile/screens/ProfileScreen';
import { EditProfileScreen } from '../features/profile/screens/EditProfileScreen';
import { BlockedUsersScreen } from '../features/profile/screens/BlockedUsersScreen';
import { ChangePasswordScreen } from '../features/profile/screens/ChangePasswordScreen';
import { DeleteAccountScreen } from '../features/profile/screens/DeleteAccountScreen';
import { NotificationSettingsScreen } from '../features/notifications/screens/NotificationSettingsScreen';
import { useTheme } from '../theme/ThemeContext';

const RootStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ChatStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function ChatNavigator() {
  return (
    <ChatStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatStack.Screen name="ChatList" component={ChatListScreen} />
      <ChatStack.Screen name="ChatRoom" component={ChatRoomScreen} />
      <ChatStack.Screen name="NewChat" component={NewChatScreen} />
      <ChatStack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <ChatStack.Screen name="AddGroupMembers" component={AddGroupMembersScreen} />
      <ChatStack.Screen name="ChatSettings" component={ChatSettingsScreen} />
      <ChatStack.Screen name="ArchivedChats" component={ArchivedChatsScreen} />
      <ChatStack.Screen name="FriendRequests" component={FriendRequestsScreen} />
      <ChatStack.Screen name="MessageSearch" component={MessageSearchScreen} />
    </ChatStack.Navigator>
  );
}

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <ProfileStack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <ProfileStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <ProfileStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
    </ProfileStack.Navigator>
  );
}

function renderAppTabBar(props) {
  return <AppTabBar {...props} />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={renderAppTabBar}
      screenOptions={{
        headerShown: false,
      }}>
      <Tab.Screen
        name="ChatsTab"
        component={ChatNavigator}
        options={{
          tabBarLabel: 'Chats',
          tabBarIconName: 'message-text',
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIconName: 'account-circle',
        }}
      />
    </Tab.Navigator>
  );
}

function PresenceController({ uid }) {
  usePresence(uid);
  return null;
}

export function AppNavigator() {
  const { user, loading } = useAuth();
  const { colors, scheme } = useTheme();

  const navTheme = useMemo(() => {
    const base = scheme === 'light' ? DefaultTheme : DarkTheme;
    return {
      ...base,
      dark: scheme === 'dark',
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [colors, scheme]);

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <>
      <PresenceController uid={user?.uid} />
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <RootStack.Screen name="Main" component={MainTabs} />
          ) : (
            <RootStack.Screen name="Auth" component={AuthNavigator} />
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </>
  );
}


