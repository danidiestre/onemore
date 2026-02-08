import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Pressable, Share, PanResponder, Keyboard, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { createSession } from '@/repo/sessions';
import { getInviteLink } from '@/utils/invite';
import { ensureAuthenticated } from '@/lib/auth';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function CreateSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sessionName, setSessionName] = useState('');
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [sessionCreated, setSessionCreated] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const dragOffset = useRef(0);

  useEffect(() => {
    // Ensure authentication is ready
    ensureAuthenticated()
      .then(() => setAuthReady(true))
      .catch((error) => {
        console.error('Auth initialization failed:', error);
      });

    // Animate drawer in
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        dragOffset.current = 0;
        dragY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward swipes
        if (gestureState.dy > 0) {
          dragOffset.current = gestureState.dy;
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = 100; // Minimum distance to close
        const velocity = gestureState.vy;

        // Close if swiped down enough or with enough velocity
        if (gestureState.dy > threshold || velocity > 0.5) {
          handleClose();
        } else {
          // Snap back
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
        dragOffset.current = 0;
      },
    })
  ).current;

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      router.back();
    });
  };

  const handleSubmit = async () => {
    if (!sessionName.trim()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (!authReady || loading) return;

    // Dismiss keyboard
    Keyboard.dismiss();

    setLoading(true);
    try {
      const session = await createSession(sessionName.trim(), []);
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const link = getInviteLink(session.invite_code);
      setInviteLink(link);
      setSessionId(session.id);
      setSessionCreated(true);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Failed to create session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(inviteLink);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLinkCopied(true);
      // Reset after 2 seconds
      setTimeout(() => {
        setLinkCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleStartSession = async () => {
    try {
      await Share.share({
        message: `Join my drink session "${sessionName}": ${inviteLink}`,
        url: inviteLink,
        title: `Join ${sessionName}`,
      });
      // Navigate after sharing (created=1 so session screen shows owner actions immediately)
      router.replace(`/session/${sessionId}?created=1`);
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        console.error('Failed to share:', error);
      }
      // Navigate anyway if share fails or user cancels
      router.replace(`/session/${sessionId}?created=1`);
    }
  };

  const baseTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [800, 0],
  });

  const translateY = Animated.add(baseTranslateY, dragY);

  // Dynamic drawer height based on state - keep same size for both
  const drawerHeight = '50%';

  return (
    <View style={styles.container}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateY }],
              paddingBottom: insets.bottom,
              height: drawerHeight,
              maxHeight: drawerHeight,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {sessionCreated ? 'Start Session' : 'New Session'}
              </Text>
            </View>

            {/* Content area with rounded background - iOS style */}
            <View style={[
              styles.contentContainer,
              !sessionCreated && styles.contentContainerCentered,
              sessionCreated && styles.contentContainerShare,
            ]}>
              {!sessionCreated ? (
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>SESSION NAME</Text>
                  <TextInput
                    style={styles.input}
                    value={sessionName}
                    onChangeText={setSessionName}
                    placeholder="Enter session name"
                    placeholderTextColor="#8E8E93"
                    autoCapitalize="words"
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    editable={!loading}
                  />
                </View>
              ) : (
                <View style={styles.shareSection}>
                  <Text style={styles.shareSectionTitle}>Start Session</Text>
                  <View style={styles.linkInputContainer}>
                    <TextInput
                      style={styles.linkInput}
                      value={inviteLink}
                      editable={false}
                      selectTextOnFocus={true}
                    />
                    <TouchableOpacity
                      onPress={handleCopyLink}
                      style={styles.copyButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name={linkCopied ? "checkmark" : "copy-outline"} 
                        size={20} 
                        color={linkCopied ? "#34C759" : "#007AFF"} 
                      />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={handleStartSession}
                    style={styles.startButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.startButtonText}>Start Session</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  drawer: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 44,
    backgroundColor: '#1C1C1E',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  contentContainer: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    flex: 1,
  },
  contentContainerCentered: {
    justifyContent: 'center',
    paddingTop: 0,
  },
  contentContainerShare: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    flex: 1,
    paddingTop: 0,
  },
  inputSection: {
    width: '100%',
  },
  inputLabel: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    color: '#FFFFFF',
    fontSize: 28,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    borderWidth: 0,
    minHeight: 80,
    textAlign: 'center',
  },
  shareSection: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  shareSectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  linkInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  linkInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 16,
  },
  copyButton: {
    padding: 8,
    marginLeft: 8,
  },
  startButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
    includeFontPadding: false,
  },
});
