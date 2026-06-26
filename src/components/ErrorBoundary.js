import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SIZES, FONTS } from '../constants/theme';
import { useTheme } from '../theme/ThemeContext';
import { PRESS_FEEDBACK, PressableScale } from './PressableScale';

function ErrorFallback({ onRetry }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong.</Text>
      <Text style={styles.message} numberOfLines={4}>
        An unexpected error occurred. Please try again.
      </Text>
      <PressableScale
        accessibilityRole="button"
        activeScale={0.97}
        activeOpacity={0.9}
        rippleColor={PRESS_FEEDBACK.lightRipple}
        style={styles.button}
        onPress={onRetry}>
        <Text style={styles.buttonText}>Try Again</Text>
      </PressableScale>
    </View>
  );
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error, info) {
    this.setState({ info });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: SIZES.lg,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    title: {
      ...FONTS.h2,
      color: colors.text,
      textAlign: 'center',
      marginBottom: SIZES.sm,
    },
    message: {
      ...FONTS.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: SIZES.lg,
    },
    button: {
      backgroundColor: colors.primaryDark,
      paddingVertical: SIZES.sm + 4,
      paddingHorizontal: SIZES.lg,
      borderRadius: SIZES.borderRadiusLg,
    },
    buttonText: {
      ...FONTS.bodyBold,
      color: colors.white,
    },
  });
}
