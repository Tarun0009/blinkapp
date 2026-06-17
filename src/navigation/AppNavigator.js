import React from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { usePresence } from '../hooks/usePresence';
import { AppTabBar } from '../components/AppTabBar';

import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { ChatListScreen } from '../features/chats/screens/ChatListScreen';
import { ChatRoomScreen } from '../features/chats/screens/ChatRoomScreen';
import { NewChatScreen } from '../features/chats/screens/NewChatScreen';
import { ChatSettingsScreen } from '../features/chats/screens/ChatSettingsScreen';
import { ArchivedChatsScreen } from '../features/chats/screens/ArchivedChatsScreen';
import { FriendRequestsScreen } from '../features/friend-requests/screens/FriendRequestsScreen';
import { AddGroupMembersScreen } from '../features/groups/screens/AddGroupMembersScreen';
import { CreateGroupScreen } from '../features/groups/screens/CreateGroupScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { BlockedUsersScreen } from '../screens/profile/BlockedUsersScreen';
import { ChangePasswordScreen } from '../screens/profile/ChangePasswordScreen';
import { DeleteAccountScreen } from '../screens/profile/DeleteAccountScreen';
import { COLORS } from '../constants/theme';

const RootStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ChatStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const NAV_THEME = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
    notification: COLORS.accent,
  },
};

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

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <>
      <PresenceController uid={user?.uid} />
      <NavigationContainer theme={NAV_THEME}>
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
