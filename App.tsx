import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { RealtimeProvider } from './src/context/RealtimeContext';
import { NetworkProvider } from './src/shared/network/NetworkProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ConnectionBanner } from './src/components/ConnectionBanner';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { attachNotificationHandlers } from './src/features/notifications/services/notificationHandlers';

function AppStatusBar() {
  const { colors, scheme } = useTheme();
  return (
    <StatusBar
      barStyle={scheme === 'light' ? 'dark-content' : 'light-content'}
      backgroundColor={colors.background}
    />
  );
}

function App() {
  useEffect(() => {
    const unsubscribe = attachNotificationHandlers();
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppStatusBar />
        <NetworkProvider>
          <ErrorBoundary>
            <AuthProvider>
              <RealtimeProvider>
                <AppNavigator />
                <ConnectionBanner />
              </RealtimeProvider>
            </AuthProvider>
          </ErrorBoundary>
        </NetworkProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
