import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';

// List of emojis for sessions
const SESSION_EMOJIS = [
  '🏝️', '💳', '🏖️', '🏔️', '🏛️', '🌴', '🏰', '🌊', 
  '🎉', '🍺', '🍻', '🥂', '🍷', '🍸', '🍹', '🎊',
  '🎈', '🎁', '🎂', '🍰', '🍕', '🌮', '🍔', '🍟'
];

export default function HomeScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
    
    // Subscribe to session changes
    const channel = supabase
      .channel('sessions_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
      }, () => {
        loadSessions();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const loadSessions = async () => {
    try {
      // Wait for authentication
      let { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const { data: authData } = await supabase.auth.signInAnonymously();
        user = authData?.user;
      }
      if (!user) return;

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generate a consistent emoji for each session based on its ID
  const getSessionEmoji = (sessionId: string) => {
    // Use the session ID to generate a consistent emoji index
    let hash = 0;
    for (let i = 0; i < sessionId.length; i++) {
      hash = sessionId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return SESSION_EMOJIS[Math.abs(hash) % SESSION_EMOJIS.length];
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.listItem}
            onPress={() => router.push(`/session/${item.id}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{getSessionEmoji(item.id)}</Text>
            <Text style={styles.listItemTitle}>{item.name}</Text>
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={sessions.length === 0 ? [styles.listContent, styles.emptyContainer] : styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No sessions yet</Text>
            <Text style={styles.emptySubtext}>Tap + to create your first session</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loader: {
    marginTop: 100,
  },
  listContent: {
    padding: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    minHeight: 72,
  },
  emoji: {
    fontSize: 32,
    marginRight: 16,
  },
  listItemTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '400',
    flex: 1,
  },
  separator: {
    height: 0,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#8E8E93',
    fontSize: 15,
  },
  emptyContainer: {
    flexGrow: 1,
  },
});
