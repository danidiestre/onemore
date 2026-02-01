import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { addParticipantSlot } from '@/repo/sessions';
import { ensureAuthenticated } from '@/lib/auth';
import * as Haptics from 'expo-haptics';

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    loadSession();
  }, [code]);

  const loadSession = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('id')
        .eq('invite_code', code)
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error('Session not found');
      }

      setSessionId(data.id);
    } catch (err: any) {
      console.error('Failed to load session:', err);
      Alert.alert('Error', 'Session not found');
      setTimeout(() => {
        router.back();
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!sessionId || !name.trim() || joining) return;

    setJoining(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await addParticipantSlot(sessionId, name.trim());
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/session/${sessionId}`);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to join session');
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter your name</Text>
      <TextInput
        style={styles.nameInput}
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        placeholderTextColor="rgba(255, 255, 255, 0.5)"
        autoFocus={true}
        onSubmitEditing={handleJoin}
        returnKeyType="done"
        editable={!joining}
      />
      <TouchableOpacity
        style={[styles.joinButton, (!name.trim() || joining) && styles.joinButtonDisabled]}
        onPress={handleJoin}
        disabled={!name.trim() || joining}
      >
        {joining ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.joinButtonText}>Join Session</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 32,
    textAlign: 'center',
  },
  nameInput: {
    backgroundColor: '#1C1C1E',
    color: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    fontSize: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    minHeight: 56,
  },
  joinButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  joinButtonDisabled: {
    backgroundColor: '#3C3C3E',
    opacity: 0.5,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
