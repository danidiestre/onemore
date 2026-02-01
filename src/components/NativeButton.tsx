import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

interface NativeButtonProps extends Omit<TouchableOpacityProps, 'children'> {
  children: string;
  disabled?: boolean;
}

/**
 * NativeButton - A reusable iOS button component following Apple's Human Interface Guidelines
 * and liquid glass design specifications.
 * 
 * Based on Apple's design system:
 * - Uses liquid glass (frosted glass) effect with proper blur intensity
 * - Follows Apple's button sizing and spacing guidelines
 * - Implements proper touch targets (minimum 44x44 points)
 * - Uses system colors and typography
 * 
 * Reference: https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
 */
export function NativeButton({ children, disabled, style, ...props }: NativeButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      activeOpacity={0.6}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      disabled={disabled}
      {...props}
    >
      <BlurView 
        intensity={Platform.OS === 'ios' ? 80 : 100} 
        tint="dark" 
        style={styles.buttonBlur}
      >
        <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
          {children}
        </Text>
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44, // Apple's minimum touch target
    minHeight: 44, // Apple's minimum touch target
  },
  buttonBlur: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Apple's liquid glass background - semi-transparent dark gray
    // Matches iOS system button appearance
    backgroundColor: Platform.OS === 'ios' 
      ? 'rgba(60, 60, 67, 0.4)' // iOS system gray with proper opacity
      : 'rgba(60, 60, 67, 0.3)', // Slightly more transparent on other platforms
  },
  buttonText: {
    // Apple's system blue color for interactive elements
    color: '#007AFF',
    fontSize: 32,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 32,
    // Apple's preferred font weight for navigation buttons
    fontWeight: '300',
    // Ensure proper text rendering
    includeFontPadding: false,
  },
  buttonTextDisabled: {
    // Apple's system gray for disabled states
    color: '#8E8E93',
  },
});
