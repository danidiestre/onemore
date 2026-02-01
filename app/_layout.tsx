import { Stack, useRouter, Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { TouchableOpacity, Text, Pressable } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Bootstrap anonymous auth on app start
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          await supabase.auth.signInAnonymously();
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      }
    })();

    // Handle deep links
    const handleDeepLink = ({ url }: { url: string }) => {
      const parsed = Linking.parse(url);
      const path = parsed.path || parsed.hostname;
      if (path?.includes('/join/')) {
        const code = path.split('/join/')[1]?.split('/')[0]?.split('?')[0];
        if (code) {
          router.push(`/join/${code}`);
        }
      }
    };

    // Check initial URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Listen for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#000000',
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: '#000000',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={({ navigation }) => ({
            title: 'Sessions',
            headerLeft: () => null,
            headerBackVisible: false,
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('create-session')}
                activeOpacity={0.4}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={{ 
                  color: '#007AFF', 
                  fontSize: 32,
                  textAlign: 'center',
                  textAlignVertical: 'center',
                  lineHeight: 32,
                  fontWeight: '300',
                  width: 32,
                  height: 32,
                }}>+</Text>
              </TouchableOpacity>
            ),
          })}
        />
        <Stack.Screen name="create-session" options={{ headerShown: false, presentation: 'transparentModal' }} />
        <Stack.Screen name="join/[code]" options={{ title: 'Join Session' }} />
        <Stack.Screen 
          name="session/[id]" 
          options={{ 
            title: 'Session',
          }} 
        />
        <Stack.Screen 
          name="session/[id]/settings" 
          options={{ 
            title: 'Settings', 
            presentation: 'modal',
            headerStyle: {
              backgroundColor: '#1C1C1E',
            },
            contentStyle: {
              backgroundColor: '#1C1C1E',
            },
            headerTitleStyle: {
              fontWeight: '600',
            },
          }} 
        />
        <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      </Stack>
    </>
  );
}
