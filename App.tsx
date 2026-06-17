import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { RealtimeProvider } from './src/context/RealtimeContext';
import { NetworkProvider } from './src/shared/network/NetworkProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ConnectionBanner } from './src/components/ConnectionBanner';
import { COLORS } from './src/constants/theme';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
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
    </SafeAreaProvider>
  );
}

export default App;
