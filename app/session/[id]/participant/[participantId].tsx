import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import React, { useEffect, useState, useLayoutEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Participant } from '@/types/database';
import { updateParticipant, removeParticipantSlot, loadSessionData } from '@/repo/sessions';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Extended color palette matching the photo exactly
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

export default function EditParticipantScreen() {
  const { id, participantId } = useLocalSearchParams<{ id: string; participantId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!id || !participantId) return;
    loadParticipant();
  }, [id, participantId]);

  const loadParticipant = async () => {
    if (!id || !participantId) return;
    try {
      const data = await loadSessionData(id);
      const foundParticipant = data.participants.find(p => p.id === participantId);
      if (foundParticipant) {
        setParticipant(foundParticipant);
        setOriginalName(foundParticipant.display_name);
        setName(''); // Start with empty input
        setIsOwner(data.isOwner);
        
        // Use saved color_index if available, otherwise calculate based on creation order
        if (foundParticipant.color_index !== null && foundParticipant.color_index !== undefined) {
          setSelectedColorIndex(foundParticipant.color_index % PARTICIPANT_COLORS.length);
        } else {
          // Fallback: calculate color index based on creation order
          const sortedParticipants = [...data.participants].sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          const colorIndex = sortedParticipants.findIndex(p => p.id === participantId);
          setSelectedColorIndex(colorIndex >= 0 ? colorIndex % PARTICIPANT_COLORS.length : 0);
        }
      }
    } catch (error) {
      console.error('Failed to load participant:', error);
      Alert.alert('Error', 'Failed to load participant');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || !participantId) return;

    // If name is empty, keep the original name
    const newName = name.trim() || originalName;
    if (!newName) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    try {
      await updateParticipant(id, participantId, { 
        display_name: newName,
        color_index: selectedColorIndex 
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to update participant');
    }
  };

  const handleColorChange = async (colorIndex: number) => {
    setSelectedColorIndex(colorIndex);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Save color immediately when selected
    if (id && participantId) {
      try {
        await updateParticipant(id, participantId, { color_index: colorIndex });
      } catch (error: any) {
        console.error('Failed to save color:', error);
        // Don't show error to user, just log it
      }
    }
  };

  const handleDelete = () => {
    if (!id || !participantId || !isOwner) return;

    Alert.alert(
      'Delete Participant',
      'Are you sure you want to delete this participant?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeParticipantSlot(id, participantId);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (error: any) {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to delete participant');
            }
          },
        },
      ]
    );
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerShown: true,
      headerBackTitleVisible: false,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.4}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ marginLeft: 10, flexDirection: 'row', alignItems: 'center' }}
        >
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
          <Text style={{ color: '#007AFF', fontSize: 17, marginLeft: 4 }}>Back</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        isOwner ? (
          <TouchableOpacity
            onPress={handleDelete}
            activeOpacity={0.4}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 16 }}
          >
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        ) : null
      ),
    });
  }, [navigation, router, isOwner, id, participantId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!participant) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Participant not found</Text>
      </View>
    );
  }

  const selectedColor = PARTICIPANT_COLORS[selectedColorIndex % PARTICIPANT_COLORS.length];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Text Input Field - Large rounded field matching photo */}
        <TextInput
          style={[styles.nameInput, { backgroundColor: selectedColor }]}
          value={name}
          onChangeText={setName}
          placeholder={originalName || "Enter name"}
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          autoFocus={true}
          onSubmitEditing={handleSave}
          returnKeyType="done"
          blurOnSubmit={true}
          selectTextOnFocus={false}
        />

        {/* Color Swatches - Two rows matching photo layout */}
        <View style={styles.colorSwatchesContainer}>
          {/* First row - 6 colors */}
          <View style={styles.colorRow}>
            {PARTICIPANT_COLORS.slice(0, 6).map((color, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  selectedColorIndex % PARTICIPANT_COLORS.length === index && styles.selectedSwatch,
                ]}
                onPress={() => handleColorChange(index)}
                activeOpacity={0.7}
              >
                {selectedColorIndex % PARTICIPANT_COLORS.length === index && (
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ fontWeight: 'bold' }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
          {/* Second row - 6 colors */}
          <View style={styles.colorRow}>
            {PARTICIPANT_COLORS.slice(6, 12).map((color, index) => {
              const actualIndex = index + 6;
              return (
                <TouchableOpacity
                  key={actualIndex}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    selectedColorIndex % PARTICIPANT_COLORS.length === actualIndex && styles.selectedSwatch,
                  ]}
                  onPress={() => {
                    setSelectedColorIndex(actualIndex);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    // Update input background color immediately
                    setName(name); // Trigger re-render
                  }}
                  activeOpacity={0.7}
                >
                  {selectedColorIndex % PARTICIPANT_COLORS.length === actualIndex && (
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ fontWeight: 'bold' }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 24,
  },
  nameInput: {
    width: '100%',
    minHeight: 110,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 24,
    fontSize: 22,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'left',
  },
  colorSwatchesContainer: {
    gap: 16,
    paddingHorizontal: 4,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  colorSwatch: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 60,
    maxHeight: 60,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
    minHeight: 50,
  },
  selectedSwatch: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 17,
    textAlign: 'center',
    marginTop: 32,
  },
});
