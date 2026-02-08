import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, ActionSheetIOS, Platform, Dimensions, Animated, PanResponder, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import React, { useEffect, useState, useRef, useLayoutEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import type { Participant, DrinkType, DrinkEvent } from '@/types/database';
import { loadSessionData, addDrinkEvent, addParticipantSlot, removeParticipantSlot } from '@/repo/sessions';
import { getInviteLink } from '@/utils/invite';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = 10;
const CARD_WIDTH = SCREEN_WIDTH - 2 * CARD_HORIZONTAL_PADDING;

// Color palette for participant cards - must match the array in participant/[participantId].tsx
const PARTICIPANT_COLORS = [
  '#007AFF', // Blue (row 1, col 1)
  '#AF52DE', // Purple (row 1, col 2)
  '#FF2D55', // Hot Pink (row 1, col 3)
  '#FF9500', // Red-Orange (row 1, col 4)
  '#FFCC00', // Orange/Yellow (row 1, col 5)
  '#FFD700', // Yellow (row 1, col 6)
  '#32CD32', // Lime Green (row 2, col 1)
  '#00CED1', // Teal/Aqua (row 2, col 2)
  '#D2691E', // Brown/Tan (row 2, col 3)
  '#708090', // Light Gray/Slate Blue (row 2, col 4)
  '#000080', // Dark Blue/Navy (row 2, col 5)
  '#FF1493', // Deep Pink (row 2, col 6 - gradient option)
];

// Spanish animal names
const SPANISH_ANIMALS = [
  'Panda',
  'Mariposa',
  'Tigre',
  'Caballo',
  'Leopardo',
  'Lémur',
  'Elefante',
  'Jirafa',
  'León',
  'Oso',
  'Lobo',
  'Zorro',
  'Conejo',
  'Ardilla',
  'Delfín',
  'Ballena',
  'Tiburón',
  'Águila',
  'Búho',
  'Colibrí',
];

export default function SessionScreen() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [drinkTypes, setDrinkTypes] = useState<DrinkType[]>([]);
  const [events, setEvents] = useState<DrinkEvent[]>([]);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [sessionName, setSessionName] = useState<string>('');
  const [isOwnerFromData, setIsOwnerFromData] = useState(false);
  // Show owner UI when backend says so, or when we just navigated from create-session (avoids auth race)
  const isOwner = isOwnerFromData || created === '1';
  const [currentParticipantId, setCurrentParticipantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState<Map<string, { count: number; timestamp: number }>>(new Map());
  const participantColorMapRef = useRef<Map<string, number>>(new Map());
  const localEventsRef = useRef<DrinkEvent[]>([]);

  useEffect(() => {
    if (!id) return;
    loadData();
    subscribeToChanges();
    
    // Clean up recent events after 2 seconds
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setRecentEvents(prev => {
        const newMap = new Map(prev);
        let changed = false;
        newMap.forEach((value, key) => {
          if (now - value.timestamp > 2000) {
            newMap.delete(key);
            changed = true;
          }
        });
        return changed ? newMap : prev;
      });
    }, 500);
    
    return () => {
      clearInterval(cleanupInterval);
      // Cleanup subscription handled by Supabase client
    };
  }, [id]);

  // Reload data when screen comes into focus (e.g., returning from edit page)
  useFocusEffect(
    useCallback(() => {
      if (id) {
        loadData();
      }
    }, [id])
  );

  const loadData = async () => {
    if (!id) return;
    try {
      const data = await loadSessionData(id);
      
      // Before updating participants, map temp IDs to real IDs if they exist
      // This preserves colors when a temp participant becomes real
      const tempIdToRealId = new Map<string, string>();
      const currentParticipants = participants;
      const newParticipants = data.participants;
      
      // Find matching participants by name and created_at (within 30 seconds for safety)
      // Match temp participants to real ones
      currentParticipants.forEach(currentP => {
        if (currentP.id.startsWith('temp-')) {
          // Find the best match: same name, similar timestamp
          // Sort by timestamp difference to get the closest match
          const matches = newParticipants
            .filter(newP => 
              newP.display_name === currentP.display_name &&
              Math.abs(new Date(newP.created_at).getTime() - new Date(currentP.created_at).getTime()) < 30000
            )
            .sort((a, b) => {
              const diffA = Math.abs(new Date(a.created_at).getTime() - new Date(currentP.created_at).getTime());
              const diffB = Math.abs(new Date(b.created_at).getTime() - new Date(currentP.created_at).getTime());
              return diffA - diffB;
            });
          
          if (matches.length > 0) {
            // Use the closest match that doesn't already have a color (unless it's from this tempId)
            const bestMatch = matches.find(m => !participantColorMapRef.current.has(m.id)) || matches[0];
            tempIdToRealId.set(currentP.id, bestMatch.id);
          }
        }
      });
      
      // Transfer color mappings from temp IDs to real IDs BEFORE updating state
      // This is critical to preserve colors
      const preservedColorMap = new Map<string, number>();
      tempIdToRealId.forEach((realId, tempId) => {
        const colorIndex = participantColorMapRef.current.get(tempId);
        if (colorIndex !== undefined) {
          // Store the preserved color
          preservedColorMap.set(realId, colorIndex);
          // Preserve the color by setting it on the real ID IMMEDIATELY
          participantColorMapRef.current.set(realId, colorIndex);
          participantColorMapRef.current.delete(tempId);
        }
      });
      
      // Now update state - the color map is already updated
      setParticipants(data.participants);
      setDrinkTypes(data.drinkTypes);
      setEvents(data.events);
      localEventsRef.current = data.events;
      setInviteCode(data.inviteCode);
      setSessionName(data.sessionName);
      setIsOwnerFromData(data.isOwner);
      setCurrentParticipantId(data.currentParticipantId ?? null);

      // Update color map: use saved color_index if available, otherwise assign based on creation order
      // This ensures colors are always consistent regardless of when data is reloaded
      const sortedParticipants = [...data.participants].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      // Assign colors: prefer saved color_index, fallback to creation order
      sortedParticipants.forEach((p, index) => {
        const isPreserved = preservedColorMap.has(p.id);
        
        if (isPreserved) {
          // Use preserved color from temp-to-real mapping (only for temp participants becoming real)
          const preservedIndex = preservedColorMap.get(p.id);
          if (preservedIndex !== undefined) {
            participantColorMapRef.current.set(p.id, preservedIndex);
          }
        } else if (p.color_index !== null && p.color_index !== undefined) {
          // Always use saved color_index from database if available (this is the source of truth)
          participantColorMapRef.current.set(p.id, p.color_index);
        } else {
          // Fallback: use creation order position if no color_index is saved
          const hasColor = participantColorMapRef.current.has(p.id);
          if (!hasColor) {
            participantColorMapRef.current.set(p.id, index);
          }
          // If hasColor but no saved color_index, keep existing color (for stability when participants are deleted)
        }
      });
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChanges = () => {
    if (!id) return;

    const participantsChannel = supabase
      .channel(`participants:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'participants',
        filter: `session_id=eq.${id}`,
      }, () => {
        loadData();
      })
      .subscribe();

    const drinkTypesChannel = supabase
      .channel(`drink_types:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'drink_types',
        filter: `session_id=eq.${id}`,
      }, () => {
        loadData();
      })
      .subscribe();

    const eventsChannel = supabase
      .channel(`drink_events:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'drink_events',
        filter: `session_id=eq.${id}`,
      }, async (payload) => {
        // When a new event arrives from server, merge it with local optimistic events
        if (payload.eventType === 'INSERT' && payload.new) {
          const newEvent = payload.new as DrinkEvent;
          // Remove any temp events for the same participant/drinkType/delta combination
          // and add the real event
          const tempEvents = localEventsRef.current.filter(e => e.id.startsWith('temp-'));
          const realEvents = localEventsRef.current.filter(e => !e.id.startsWith('temp-'));
          
          // Check if we have a matching temp event
          const matchingTemp = tempEvents.find(e => 
            e.target_participant_id === newEvent.target_participant_id &&
            e.drink_type_id === newEvent.drink_type_id &&
            e.delta === newEvent.delta &&
            Math.abs(new Date(e.created_at).getTime() - new Date(newEvent.created_at).getTime()) < 5000
          );
          
          if (matchingTemp) {
            // Replace temp event with real one
            const updatedEvents = [...realEvents, newEvent];
            localEventsRef.current = updatedEvents;
            setEvents(updatedEvents);
          } else {
            // No matching temp event, just add the new one
            const updatedEvents = [...localEventsRef.current, newEvent];
            localEventsRef.current = updatedEvents;
            setEvents(updatedEvents);
            
            // Track recent event for animation
            const now = Date.now();
            setRecentEvents(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(newEvent.target_participant_id);
              newMap.set(newEvent.target_participant_id, {
                count: existing ? existing.count + 1 : 1,
                timestamp: now
              });
              return newMap;
            });
          }
        } else {
          // For other events (UPDATE, DELETE), reload all data
          await loadData();
        }
      })
      .subscribe();

    return () => {
      participantsChannel.unsubscribe();
      drinkTypesChannel.unsubscribe();
      eventsChannel.unsubscribe();
    };
  };

  const handleIncrement = (participantId: string, drinkTypeId?: string) => {
    if (!id || drinkTypes.length === 0) return;
    if (!isOwner && currentParticipantId !== null && participantId !== currentParticipantId) return;

    const selectedDrinkTypeId = drinkTypeId || (drinkTypes.length === 1 ? drinkTypes[0].id : null);
    
    // If multiple drink types and no drinkTypeId provided, show picker
    if (!selectedDrinkTypeId) {
      showDrinkTypePicker(participantId, 1);
      return;
    }
    
    // Optimistic update: add event immediately to local state
    const tempEvent: DrinkEvent = {
      id: `temp-${Date.now()}`,
      session_id: id,
      actor_user_id: '',
      target_participant_id: participantId,
      drink_type_id: selectedDrinkTypeId,
      delta: 1,
      created_at: new Date().toISOString(),
    };
    
    const newEvents = [...localEventsRef.current, tempEvent];
    localEventsRef.current = newEvents;
    setEvents(newEvents);
    
    // Track recent event for animation
    const now = Date.now();
    setRecentEvents(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(participantId);
      newMap.set(participantId, {
        count: existing ? existing.count + 1 : 1,
        timestamp: now
      });
      return newMap;
    });
    
    // Haptic feedback immediately (don't await)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Sync with server in background (don't await)
    addDrinkEvent(id, participantId, selectedDrinkTypeId, 1)
      .catch((error) => {
        // Rollback on error
        localEventsRef.current = localEventsRef.current.filter(e => e.id !== tempEvent.id);
        setEvents(localEventsRef.current);
        console.error('Failed to add drink:', error);
      });
    // Note: We keep the temp event until the real one arrives via subscription
  };

  const handleDecrement = (participantId: string) => {
    if (!id || drinkTypes.length === 0) return;
    if (!isOwner && currentParticipantId !== null && participantId !== currentParticipantId) return;

    // If multiple drink types, show picker, otherwise use first one
    if (drinkTypes.length > 1) {
      showDrinkTypePicker(participantId, -1);
      return;
    }
    
    // Optimistic update: add event immediately to local state
    const tempEvent: DrinkEvent = {
      id: `temp-${Date.now()}`,
      session_id: id,
      actor_user_id: '',
      target_participant_id: participantId,
      drink_type_id: drinkTypes[0].id,
      delta: -1,
      created_at: new Date().toISOString(),
    };
    
    const newEvents = [...localEventsRef.current, tempEvent];
    localEventsRef.current = newEvents;
    setEvents(newEvents);
    
    // Track recent event for animation
    const now = Date.now();
    setRecentEvents(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(participantId);
      newMap.set(participantId, {
        count: existing ? existing.count + 1 : 1,
        timestamp: now
      });
      return newMap;
    });
    
    // Haptic feedback immediately (don't await)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Sync with server in background (don't await)
    addDrinkEvent(id, participantId, drinkTypes[0].id, -1)
      .catch((error) => {
        // Rollback on error
        localEventsRef.current = localEventsRef.current.filter(e => e.id !== tempEvent.id);
        setEvents(localEventsRef.current);
        console.error('Failed to remove drink:', error);
      });
    // Note: We keep the temp event until the real one arrives via subscription
  };

  const showDrinkTypePicker = (participantId: string, delta: number) => {
    if (Platform.OS !== 'ios') return;

    const options = [...drinkTypes.map(dt => `${dt.emoji} ${dt.name}`), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
      },
      async (buttonIndex) => {
        if (buttonIndex < drinkTypes.length && id) {
          const selectedDrinkTypeId = drinkTypes[buttonIndex].id;
          
          // Optimistic update: add event immediately to local state
          const tempEvent: DrinkEvent = {
            id: `temp-${Date.now()}`,
            session_id: id,
            actor_user_id: '',
            target_participant_id: participantId,
            drink_type_id: selectedDrinkTypeId,
            delta: delta as 1 | -1,
            created_at: new Date().toISOString(),
          };
          
          const newEvents = [...localEventsRef.current, tempEvent];
          localEventsRef.current = newEvents;
          setEvents(newEvents);
          
          // Haptic feedback immediately (don't await)
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          
          // Sync with server in background (don't await)
          addDrinkEvent(id, participantId, selectedDrinkTypeId, delta as 1 | -1)
            .catch((error) => {
              // Rollback on error
              localEventsRef.current = localEventsRef.current.filter(e => e.id !== tempEvent.id);
              setEvents(localEventsRef.current);
              console.error('Failed to add drink:', error);
            });
          // Note: We keep the temp event until the real one arrives via subscription
        }
      }
    );
  };

  const handleMenuPress = (participantId: string) => {
    router.push(`/session/${id}/participant/${participantId}`);
  };


  const getParticipantCount = (participantId: string) => {
    const participantEvents = events.filter(e => e.target_participant_id === participantId);
    return participantEvents.reduce((sum, e) => sum + e.delta, 0);
  };

  const getParticipantDrinkTypeCount = (participantId: string, drinkTypeId: string) => {
    const participantEvents = events.filter(
      e => e.target_participant_id === participantId && e.drink_type_id === drinkTypeId
    );
    return participantEvents.reduce((sum, e) => sum + e.delta, 0);
  };

  const getCardColor = (index: number) => {
    return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
  };

  // Determine if a color is light/bright and needs dark text
  const getTextColor = (backgroundColor: string): string => {
    // Remove # if present
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // If luminance is high (bright color), use black text, otherwise white
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  };

  // Component for animated recent event badge
  const RecentEventBadge = ({ count, textColor }: { count: number; textColor: string }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          tension: 100,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }, [count]);

    const isDarkText = textColor === '#000000';
    const badgeBgColor = isDarkText ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.9)';
    const badgeTextColor = isDarkText ? '#000000' : '#FFFFFF';

    return (
      <Animated.View
        style={[
          styles.recentEventBadge,
          { 
            transform: [{ scale: scaleAnim }],
            backgroundColor: badgeBgColor
          }
        ]}
      >
        <Text style={[styles.recentEventText, { color: badgeTextColor }]}>+{count}</Text>
      </Animated.View>
    );
  };

  const handleDeleteParticipant = async (participantId: string) => {
    if (!id || !isOwner) return;
    try {
      await removeParticipantSlot(id, participantId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadData();
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to delete participant');
    }
  };

  const handleShareLink = useCallback(async () => {
    if (!inviteCode) return;

    const shareUrl = getInviteLink(inviteCode);
    const shareMessage = `Join my drink counter session!\n\nCode: ${inviteCode}\n\nOr open this link: ${shareUrl}`;
    
    try {
      if (Platform.OS === 'ios') {
        await Share.share({
          message: shareMessage,
          url: shareUrl,
        });
      } else {
        await Share.share({
          message: shareMessage,
        });
      }
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        console.error('Error sharing:', error);
      }
    }
  }, [inviteCode]);

  const handleAddParticipantCallback = useCallback(async () => {
    if (!id || !isOwner) return;
    
    // Use functional update to get the latest participants state
    // This ensures we include any temporary participants from previous rapid clicks
    setParticipants(prev => {
      // Get existing participant names (including temporary ones) to avoid duplicates
      const existingNames = prev.map(p => p.display_name);
      
      // Find the next available animal name based on current count
      const animalIndex = prev.length % SPANISH_ANIMALS.length;
      let animalName = SPANISH_ANIMALS[animalIndex];
      
      // If the name is already taken, find the next available one
      let counter = 1;
      let finalName = animalName;
      while (existingNames.includes(finalName)) {
        finalName = `${animalName} ${counter}`;
        counter++;
      }
      
      // Optimistic update: add participant immediately to UI
      // Use timestamp + random to ensure unique IDs even with rapid clicks
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const tempCreatedAt = new Date().toISOString();
      
      // Calculate color index based on creation order position
      // Create a temporary participant object to calculate position
      const tempParticipant = {
        id: tempId,
        session_id: id,
        display_name: finalName,
        claimed_by_user_id: null,
        color_index: null,
        created_at: tempCreatedAt,
      };
      const allParticipants = [...prev, tempParticipant];
      const sortedAll = [...allParticipants].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      // Find the position of the new participant in the sorted order
      const assignedColorIndex = sortedAll.findIndex(p => p.id === tempId);
      
      const newParticipant: Participant = {
        id: tempId,
        session_id: id,
        display_name: finalName,
        claimed_by_user_id: null,
        color_index: assignedColorIndex,
        created_at: tempCreatedAt,
      };
      
      // Set color in map FIRST, before updating state
      participantColorMapRef.current.set(tempId, assignedColorIndex);
      
      // Haptic feedback immediately (don't await to avoid blocking)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Sync with server in background (don't await to avoid blocking state update)
      // Each click creates its own async operation that runs in parallel
      addParticipantSlot(id, finalName, assignedColorIndex)
        .then(async () => {
          // Small delay to ensure server has processed the insert
          await new Promise(resolve => setTimeout(resolve, 100));
          // Reload to get the real participant ID from server
          await loadData();
        })
        .catch(async (error: any) => {
          // Only show error if it's not a duplicate key error (which we handle gracefully)
          if (!error.message?.includes('duplicate key') && !error.message?.includes('unique constraint')) {
            // Rollback on error
            setParticipants(current => current.filter(p => p.id !== tempId));
            participantColorMapRef.current.delete(tempId);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', error.message || 'Failed to add participant');
          } else {
            // For duplicate errors, just reload to sync with server state
            await loadData();
          }
        });
      
      // Return updated participants list immediately
      return [...prev, newParticipant];
    });
  }, [id, isOwner]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerShown: true,
      headerBackTitleVisible: false,
      headerLeft: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.push('/')}
            activeOpacity={0.4}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 10, marginRight: 24 }}
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push(`/session/${id}/settings`)}
            activeOpacity={0.4}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 24 }}
          >
            <Ionicons name="settings-outline" size={28} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShareLink}
            activeOpacity={0.4}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 12 }}
          >
            <Ionicons name="share-outline" size={28} color="#007AFF" />
          </TouchableOpacity>
        </View>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.push(`/session/${id}/balances`)}
            activeOpacity={0.4}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 16, marginRight: isOwner ? 38 : 16 }}
          >
            <Ionicons name="cash-outline" size={28} color="#007AFF" />
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity
              onPress={handleAddParticipantCallback}
              activeOpacity={0.4}
            >
              <Ionicons name="add" size={36} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [navigation, sessionName, isOwner, id, router, handleShareLink, handleAddParticipantCallback]);

  // Swipeable Card Component
  const SwipeableCard = ({ 
    children, 
    onSwipeComplete, 
    participantId,
    cardHeight,
    borderRadius 
  }: { 
    children: React.ReactNode; 
    onSwipeComplete: () => void;
    participantId: string;
    cardHeight?: number;
    borderRadius?: number | object;
  }) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const SWIPE_THRESHOLD = -100; // Swipe threshold to trigger delete

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only respond to horizontal swipes (left swipe for delete)
          // Require more horizontal movement than vertical to distinguish from scroll
          return isOwner && Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        },
        onPanResponderTerminationRequest: () => false, // Don't allow parent to take over
        onPanResponderMove: (_, gestureState) => {
          // Only allow left swipe (negative dx)
          if (gestureState.dx < 0) {
            translateX.setValue(gestureState.dx);
            // Show trash icon opacity based on swipe distance (more swipe = more red)
            const swipeProgress = Math.min(Math.abs(gestureState.dx) / 100, 1);
            opacity.setValue(swipeProgress);
          } else {
            // Reset if swiping right
            opacity.setValue(0);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < SWIPE_THRESHOLD) {
            // Swipe complete - delete
            Animated.parallel([
              Animated.timing(translateX, {
                toValue: -Dimensions.get('window').width,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start(() => {
              onSwipeComplete();
            });
          } else {
            // Snap back
            Animated.parallel([
              Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
      })
    ).current;

    return (
      <View style={{ overflow: 'hidden', height: cardHeight }}>
        {/* Trash icon background - behind the card */}
        <Animated.View 
          style={[
            styles.swipeDeleteBackground,
            {
              opacity: opacity,
            }
          ]}
        >
          <Ionicons name="trash" size={32} color="#FFFFFF" />
        </Animated.View>
        
        {/* Card content - in front */}
        <Animated.View
          style={{
            transform: [{ translateX }],
            height: cardHeight,
            backgroundColor: 'transparent',
            zIndex: 2,
          }}
          {...(isOwner ? panResponder.panHandlers : {})}
        >
          {children}
        </Animated.View>
      </View>
    );
  };

  const renderCard = (item: Participant, index: number, cardHeight?: number, isScrollable?: boolean, borderRadius?: number | object, participantCount?: number, drinkTypesList?: DrinkType[]) => {
    const count = getParticipantCount(item.id);
    // Use original index from color map to maintain color when participants are deleted
    const originalIndex = participantColorMapRef.current.get(item.id) ?? index;
    const cardColor = getCardColor(originalIndex);
    const textColor = getTextColor(cardColor);
    
    // Calculate dynamic font size based on number of participants
    let countFontSize = 80;
    if (participantCount) {
      if (participantCount === 4) {
        countFontSize = 60;
      } else if (participantCount === 5) {
        countFontSize = 50;
      }
    }
    
    if (isScrollable) {
      // Horizontal layout for 6+ cards (like image 2)
      return (
        <View
          style={[
            styles.participantCard,
            styles.scrollableCard,
            { backgroundColor: cardColor }
          ]}
        >
          <TouchableOpacity
            onPress={() => handleMenuPress(item.id)}
            style={[styles.scrollableMenuButton, styles.scrollableMenuButtonAbsolute]}
          >
            <Text style={[styles.scrollableMenuIcon, { color: textColor }]}>⋯</Text>
          </TouchableOpacity>
          <View style={styles.scrollableCardContent}>
            <View style={styles.scrollableCardHeader}>
              <Text style={[styles.scrollableParticipantName, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">{item.display_name}</Text>
            </View>
            <View style={[styles.scrollableCounterContainer, participantCount && participantCount > 2 ? { paddingRight: 16 } : null]}>
              <View style={styles.scrollableCounterRow}>
                <TouchableOpacity
                  onPress={() => handleDecrement(item.id)}
                  style={styles.scrollableActionButton}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.scrollableActionButtonText, { color: textColor }]}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.scrollableCountText, { color: textColor }]}>{count}</Text>
                <TouchableOpacity
                  onPress={() => handleIncrement(item.id)}
                  style={styles.scrollableActionButton}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.scrollableActionButtonText, { color: textColor }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          {/* Drink type buttons below for scrollable cards */}
          {drinkTypesList && drinkTypesList.length > 0 && (
            <View style={[styles.scrollableDrinkTypesRowContainer, participantCount && participantCount > 2 ? { paddingRight: 16 } : null]}>
              <View style={styles.scrollableDrinkTypesRow}>
                {drinkTypesList.map((dt) => {
                  const drinkCount = getParticipantDrinkTypeCount(item.id, dt.id);
                  return (
                    <View key={dt.id} style={styles.drinkTypeContainer}>
                      {drinkCount > 0 && (
                        <View style={styles.drinkTypeCountBadge}>
                          <Text style={styles.drinkTypeCountText}>{drinkCount}</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => handleIncrement(item.id, dt.id)}
                        style={styles.drinkTypeButton}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.drinkTypeText, { color: textColor }]}>{dt.name}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      );
    }
    
    // Calculate dynamic font size for fixed cards (bigger than scrollable)
    // Scale based on available card height
    let fixedCountFontSize = 200;
    if (participantCount === 1) {
      fixedCountFontSize = 240;
    } else if (participantCount === 2) {
      fixedCountFontSize = 180;
    } else if (participantCount === 3) {
      fixedCountFontSize = 140;
    } else if (participantCount === 4) {
      fixedCountFontSize = 85;
    } else if (participantCount === 5) {
      fixedCountFontSize = 48;
    }
    
    // Vertical layout for 1-5 cards: name on top, counter centered
    const isSmallCard = participantCount === 5 || participantCount === 4;
    const isSmallestCard = participantCount === 5;
    return (
      <View
        style={[
          styles.participantCard,
          styles.fixedCard,
          isSmallCard && styles.fixedCardSmall,
          { backgroundColor: cardColor },
          cardHeight ? { height: cardHeight } : null,
          borderRadius && typeof borderRadius === 'object' ? borderRadius : borderRadius ? { borderRadius } : null
        ]}
      >
        <TouchableOpacity
          onPress={() => handleMenuPress(item.id)}
          style={[styles.fixedMenuButton, styles.fixedMenuButtonAbsolute]}
        >
          <Text style={[styles.fixedMenuIcon, { color: textColor }]}>⋯</Text>
        </TouchableOpacity>
        <View style={[styles.fixedCardHeader, isSmallCard && { marginBottom: 8 }]}>
          <View style={styles.nameContainer}>
            <Text style={[styles.fixedParticipantName, isSmallCard && { fontSize: 20 }, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">{item.display_name}</Text>
            {(() => {
              const recent = recentEvents.get(item.id);
              if (recent) {
                const now = Date.now();
                if ((now - recent.timestamp) < 2000 && recent.count > 0) {
                  return <RecentEventBadge count={recent.count} textColor={textColor} key={`${recent.timestamp}-${recent.count}`} />;
                }
              }
              return null;
            })()}
          </View>
        </View>
        <View style={[
            styles.fixedCounterCenterContainer,
            participantCount === 1 && { marginLeft: 32 },
            participantCount != null && participantCount >= 2 && { alignItems: 'flex-end' }
          ]}>
          <View style={[
              styles.fixedCounterRow,
              participantCount && participantCount > 2 ? { paddingRight: 16 } : null,
              participantCount === 1 ? { paddingLeft: 24 } : null
            ]}>
            <TouchableOpacity
              onPress={() => handleDecrement(item.id)}
              style={[
                styles.fixedActionButton,
                isSmallestCard && { width: 42, height: 42 },
                isSmallCard && !isSmallestCard && { width: 50, height: 50 }
              ]}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.fixedActionButtonText,
                isSmallestCard && { fontSize: 26 },
                isSmallCard && !isSmallestCard && { fontSize: 32 },
                { color: textColor }
              ]}>−</Text>
            </TouchableOpacity>
            <Text style={[
              styles.fixedCountText, 
              { 
                fontSize: fixedCountFontSize,
                minWidth: participantCount && participantCount <= 2 ? 130 : participantCount === 3 ? 100 : participantCount === 4 ? 70 : isSmallestCard ? 40 : 50,
                marginHorizontal: participantCount && participantCount <= 2 ? 56 : participantCount === 3 ? 40 : participantCount === 4 ? 24 : isSmallestCard ? 12 : 16,
                color: textColor
              }
            ]}>{count}</Text>
            <TouchableOpacity
              onPress={() => handleIncrement(item.id)}
              style={[
                styles.fixedActionButton,
                isSmallestCard && { width: 42, height: 42 },
                isSmallCard && !isSmallestCard && { width: 50, height: 50 }
              ]}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.fixedActionButtonText,
                isSmallestCard && { fontSize: 26 },
                isSmallCard && !isSmallestCard && { fontSize: 32 },
                { color: textColor }
              ]}>+</Text>
            </TouchableOpacity>
          </View>
          {/* Drink type buttons below the number */}
          {drinkTypesList && drinkTypesList.length > 0 && (
            <View style={[styles.drinkTypesRow, participantCount && participantCount > 2 ? { paddingRight: 16 } : null]}>
              {drinkTypesList.map((dt) => {
                const drinkCount = getParticipantDrinkTypeCount(item.id, dt.id);
                return (
                  <View key={dt.id} style={styles.drinkTypeContainer}>
                    {drinkCount > 0 && (
                      <View style={styles.drinkTypeCountBadge}>
                        <Text style={styles.drinkTypeCountText}>{drinkCount}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => handleIncrement(item.id, dt.id)}
                      style={styles.drinkTypeButton}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.drinkTypeText}>{dt.name}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const displayParticipants =
    isOwner
      ? participants
      : currentParticipantId
        ? participants.filter((p) => p.id === currentParticipantId)
        : [];
  const participantCount = displayParticipants.length;
  // Header height is now managed by React Navigation, use approximate height
  const headerHeight = 44 + insets.top; // Standard header height + safe area
  const availableHeight = SCREEN_HEIGHT - headerHeight - insets.bottom;
  
  // For 1-5 cards: calculate exact height, no scrolling
  // For 6+ cards: use scrollable list with smaller cards
  const useScrollableList = participantCount >= 6;
  
  const CARD_SPACING = 16; // Space between cards for < 6 participants
  let cardHeight: number | undefined;
  if (!useScrollableList && participantCount > 0) {
    // Calculate total spacing needed (spacing between cards, not after last)
    const totalSpacing = (participantCount - 1) * CARD_SPACING;
    // Calculate height per card accounting for spacing
    const heightPerCard = (availableHeight - totalSpacing) / participantCount;
    cardHeight = heightPerCard;
  }

  return (
    <View style={styles.container}>
      {participantCount === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {isOwner ? 'No participants yet' : 'No participant card'}
          </Text>
          {isOwner && (
            <Text style={styles.emptySubtext}>Tap + to add a participant</Text>
          )}
          {!isOwner && (
            <Text style={styles.emptySubtext}>
              Join this session via the invite link to get your card
            </Text>
          )}
        </View>
      ) : useScrollableList ? (
        <FlatList
          data={displayParticipants}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <View style={{ width: CARD_WIDTH }}>
              <SwipeableCard
                participantId={item.id}
                onSwipeComplete={() => handleDeleteParticipant(item.id)}
              >
                {renderCard(item, index, undefined, true, undefined, participantCount, drinkTypes)}
              </SwipeableCard>
            </View>
          )}
          contentContainerStyle={styles.scrollableListContent}
          scrollEnabled={true}
          showsVerticalScrollIndicator={true}
        />
      ) : (
        <View style={[
          styles.fixedContainer,
          participantCount >= 2 && { paddingBottom: 24 },
        ]}>
          {displayParticipants.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === displayParticipants.length - 1;
            let borderRadius;
            if (participantCount === 1) {
              // Single card: rounded top and bottom corners
              borderRadius = { 
                borderTopLeftRadius: 20, 
                borderTopRightRadius: 20,
                borderBottomLeftRadius: 20, 
                borderBottomRightRadius: 20 
              };
            } else if (isFirst && isLast) {
              borderRadius = 16;
            } else if (isFirst) {
              borderRadius = { borderTopLeftRadius: 16, borderTopRightRadius: 16 };
            } else if (isLast) {
              borderRadius = { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 };
            } else {
              borderRadius = 0;
            }
            return (
              <View 
                key={item.id} 
                style={{ 
                  width: CARD_WIDTH,
                  marginBottom: isLast ? 0 : CARD_SPACING,
                }}
              >
                <SwipeableCard
                  participantId={item.id}
                  cardHeight={cardHeight}
                  borderRadius={borderRadius}
                  onSwipeComplete={() => handleDeleteParticipant(item.id)}
                >
                  {renderCard(item, index, cardHeight, false, borderRadius, participantCount, drinkTypes)}
                </SwipeableCard>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fixedContainer: {
    flex: 1,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    alignItems: 'center',
  },
  scrollableListContent: {
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    padding: CARD_HORIZONTAL_PADDING,
    paddingTop: 8,
  },
  participantCard: {
    borderRadius: 16,
    padding: 20,
    justifyContent: 'space-between',
  },
  scrollableCard: {
    flexDirection: 'column',
    minHeight: 100,
    paddingLeft: 24,
    paddingRight: 24,
    paddingVertical: 20,
    marginBottom: 8,
  },
  scrollableCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scrollableCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
    paddingRight: 44,
  },
  scrollableMenuButtonAbsolute: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  scrollableParticipantName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    flex: 1,
  },
  scrollableMenuButton: {
    padding: 4,
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollableMenuIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 20,
  },
  scrollableCounterContainer: {
    alignItems: 'flex-end',
    minWidth: 150,
  },
  scrollableDrinkTypesRowContainer: {
    alignItems: 'flex-end',
    paddingRight: 0,
  },
  scrollableCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollableActionButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollableActionButtonText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 26,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  participantName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  menuButton: {
    padding: 4,
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 20,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 80,
    fontWeight: '700',
    textAlign: 'center',
  },
  scrollableCountText: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  fixedCard: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 24,
  },
  fixedCardSmall: {
    padding: 16,
  },
  fixedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingRight: 44,
  },
  fixedMenuButtonAbsolute: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recentEventBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentEventText: {
    fontSize: 14,
    fontWeight: '700',
  },
  fixedParticipantName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },
  fixedMenuButton: {
    padding: 4,
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fixedMenuIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 20,
  },
  fixedCounterCenterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fixedCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedActionButton: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fixedActionButtonText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '300',
    lineHeight: 40,
  },
  fixedCountText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  actionButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 32,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 17,
    textAlign: 'center',
    marginTop: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
  },
  swipeDeleteBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  drinkTypesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  scrollableDrinkTypesRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 0,
    flexWrap: 'wrap',
    paddingRight: 0,
  },
  drinkTypeContainer: {
    position: 'relative',
    marginHorizontal: 4,
    marginVertical: 4,
  },
  drinkTypeCountBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  drinkTypeCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  drinkTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  drinkTypeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
