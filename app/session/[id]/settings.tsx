import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActionSheetIOS, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Participant, DrinkType } from '@/types/database';
import { loadSessionData, updateDrinkType, deleteDrinkType, addParticipantSlot, removeParticipantSlot, addDrinkType, updateParticipant } from '@/repo/sessions';
import { formatCurrencyEUR } from '@/utils/currency';

export default function SettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [drinkTypes, setDrinkTypes] = useState<DrinkType[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingDrinkTypes, setEditingDrinkTypes] = useState<Map<string, string>>(new Map());
  const [editingParticipants, setEditingParticipants] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const data = await loadSessionData(id);
      setParticipants(data.participants);
      setDrinkTypes(data.drinkTypes.sort((a, b) => a.sort_order - b.sort_order));
      setIsOwner(data.isOwner);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDrinkType = async (drinkTypeId: string, field: string, value: any) => {
    if (!id || !isOwner) return;
    // Update local state immediately for better UX
    setEditingDrinkTypes(prev => {
      const newMap = new Map(prev);
      newMap.set(drinkTypeId, value);
      return newMap;
    });
    
    try {
      await updateDrinkType(id, drinkTypeId, { [field]: value });
      // Update the drinkTypes state without full reload
      setDrinkTypes(prev => prev.map(dt => 
        dt.id === drinkTypeId ? { ...dt, [field]: value } : dt
      ));
      // Clear the editing state
      setEditingDrinkTypes(prev => {
        const newMap = new Map(prev);
        newMap.delete(drinkTypeId);
        return newMap;
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update');
      // Revert on error
      setEditingDrinkTypes(prev => {
        const newMap = new Map(prev);
        newMap.delete(drinkTypeId);
        return newMap;
      });
      await loadData();
    }
  };

  const handleDeleteDrinkType = (drinkTypeId: string) => {
    if (Platform.OS !== 'ios' || !id || !isOwner) return;

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Delete', 'Cancel'],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      async (buttonIndex) => {
        if (buttonIndex === 0) {
          try {
            await deleteDrinkType(id, drinkTypeId);
            await loadData();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to delete');
          }
        }
      }
    );
  };

  const handleAddDrinkType = async () => {
    if (!id || !isOwner) return;
    Alert.prompt(
      'Add Drink Type',
      'Enter drink type name',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Add',
          onPress: async (name) => {
            if (!name?.trim()) return;
            try {
              const maxOrder = drinkTypes.length > 0 
                ? Math.max(...drinkTypes.map(dt => dt.sort_order)) 
                : -1;
              await addDrinkType(id, {
                name: name.trim(),
                emoji: '🍺',
                category: 'beer',
                price_cents: 300,
                sort_order: maxOrder + 1,
              });
              await loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to add drink type');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleAddParticipant = async () => {
    if (!id || !isOwner) return;
    Alert.prompt(
      'Add Participant',
      'Enter participant name',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Add',
          onPress: async (name) => {
            if (!name?.trim()) return;
            try {
              await addParticipantSlot(id, name.trim());
              await loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to add participant');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleUpdateParticipant = async (participantId: string, field: string, value: any) => {
    if (!id || !isOwner) return;
    // Update local state immediately for better UX
    setEditingParticipants(prev => {
      const newMap = new Map(prev);
      newMap.set(participantId, value);
      return newMap;
    });
    
    try {
      await updateParticipant(id, participantId, { [field]: value });
      // Update the participants state without full reload
      setParticipants(prev => prev.map(p => 
        p.id === participantId ? { ...p, [field]: value } : p
      ));
      // Clear the editing state
      setEditingParticipants(prev => {
        const newMap = new Map(prev);
        newMap.delete(participantId);
        return newMap;
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update');
      // Revert on error
      setEditingParticipants(prev => {
        const newMap = new Map(prev);
        newMap.delete(participantId);
        return newMap;
      });
      await loadData();
    }
  };

  const handleRemoveParticipant = (participantId: string) => {
    if (Platform.OS !== 'ios' || !id || !isOwner) return;

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Remove', 'Cancel'],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      async (buttonIndex) => {
        if (buttonIndex === 0) {
          try {
            await removeParticipantSlot(id, participantId);
            await loadData();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to remove');
          }
        }
      }
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Drink Types</Text>
          {isOwner && (
            <TouchableOpacity onPress={handleAddDrinkType}>
              <Text style={styles.addButton}>+ Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {drinkTypes.map((dt, index) => (
          <View key={dt.id} style={styles.drinkTypeCard}>
            <View style={styles.drinkTypeRow}>
              <TextInput
                style={[styles.drinkTypeInput, styles.flex1, !isOwner && styles.disabled]}
                value={editingDrinkTypes.get(dt.id) ?? dt.name}
                onChangeText={(value) => {
                  setEditingDrinkTypes(prev => {
                    const newMap = new Map(prev);
                    newMap.set(dt.id, value);
                    return newMap;
                  });
                }}
                onBlur={() => {
                  const editedValue = editingDrinkTypes.get(dt.id);
                  if (editedValue !== undefined && editedValue !== dt.name) {
                    handleUpdateDrinkType(dt.id, 'name', editedValue);
                  } else {
                    setEditingDrinkTypes(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(dt.id);
                      return newMap;
                    });
                  }
                }}
                editable={isOwner}
                placeholder="Name"
                multiline={false}
              />
              {isOwner && (
                <TouchableOpacity 
                  onPress={() => handleDeleteDrinkType(dt.id)}
                  style={styles.deleteIconButton}
                >
                  <Ionicons name="trash" size={20} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Participants</Text>
          {isOwner && (
            <TouchableOpacity onPress={handleAddParticipant}>
              <Text style={styles.addButton}>+ Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {participants.map((p) => (
          <View key={p.id} style={styles.participantCard}>
            <View style={styles.participantRow}>
              <TextInput
                style={[styles.participantInput, styles.flex1, !isOwner && styles.disabled]}
                value={editingParticipants.get(p.id) ?? p.display_name}
                onChangeText={(value) => {
                  setEditingParticipants(prev => {
                    const newMap = new Map(prev);
                    newMap.set(p.id, value);
                    return newMap;
                  });
                }}
                onBlur={() => {
                  const editedValue = editingParticipants.get(p.id);
                  if (editedValue !== undefined && editedValue !== p.display_name) {
                    handleUpdateParticipant(p.id, 'display_name', editedValue);
                  } else {
                    setEditingParticipants(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(p.id);
                      return newMap;
                    });
                  }
                }}
                editable={isOwner}
                placeholder="Name"
                multiline={false}
              />
              {isOwner && (
                <TouchableOpacity 
                  onPress={() => handleRemoveParticipant(p.id)}
                  style={styles.deleteIconButton}
                >
                  <Ionicons name="trash" size={20} color="#FF3B30" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  section: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  addButton: {
    color: '#007AFF',
    fontSize: 17,
    fontWeight: '600',
  },
  drinkTypeCard: {
    backgroundColor: '#1C1C1E',
    padding: 12,
    paddingLeft: 0,
    borderRadius: 8,
    marginBottom: 8,
  },
  drinkTypeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  drinkTypeInput: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    fontSize: 17,
    borderWidth: 1,
    borderColor: '#3C3C3E',
    minHeight: 50,
    textAlignVertical: 'center',
  },
  flex1: {
    flex: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  deleteIconButton: {
    marginLeft: 12,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantCard: {
    backgroundColor: '#1C1C1E',
    padding: 12,
    paddingLeft: 0,
    borderRadius: 8,
    marginBottom: 8,
  },
  participantRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  participantInput: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    fontSize: 17,
    borderWidth: 1,
    borderColor: '#3C3C3E',
    minHeight: 50,
    textAlignVertical: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 17,
    textAlign: 'center',
    marginTop: 32,
  },
});
