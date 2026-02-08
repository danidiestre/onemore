import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActionSheetIOS, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { Participant, DrinkType } from '@/types/database';
import { loadSessionData, updateDrinkType, deleteDrinkType, addParticipantSlot, removeParticipantSlot, addDrinkType, updateParticipant, deleteSession } from '@/repo/sessions';
import { presentCustomerCenter } from '@/lib/revenuecat';

export default function SettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [drinkTypes, setDrinkTypes] = useState<DrinkType[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingDrinkTypes, setEditingDrinkTypes] = useState<Map<string, string>>(new Map());
  const [editingParticipants, setEditingParticipants] = useState<Map<string, string>>(new Map());

  const latestForCleanup = useRef<{
    editingDrinkTypes: Map<string, string>;
    editingParticipants: Map<string, string>;
    drinkTypes: DrinkType[];
    participants: Participant[];
    id: string | undefined;
    isOwner: boolean;
  }>({
    editingDrinkTypes: new Map(),
    editingParticipants: new Map(),
    drinkTypes: [],
    participants: [],
    id: undefined,
    isOwner: false,
  });

  useEffect(() => {
    latestForCleanup.current = {
      editingDrinkTypes,
      editingParticipants,
      drinkTypes,
      participants,
      id,
      isOwner,
    };
  }, [editingDrinkTypes, editingParticipants, drinkTypes, participants, id, isOwner]);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  // Persist any dirty edits when leaving Settings (name of drink type or participant)
  useFocusEffect(
    useCallback(() => {
      return () => {
        const { editingDrinkTypes: editDt, editingParticipants: editP, drinkTypes: dts, participants: ps, id: sid, isOwner: owner } = latestForCleanup.current;
        if (!sid || !owner) return;
        dts.forEach((dt) => {
          const value = editDt.get(dt.id);
          if (value !== undefined && value.trim() !== '' && value !== dt.name) {
            updateDrinkType(sid, dt.id, { name: value.trim() }).catch((err) =>
              console.warn('Failed to save drink type name on leave:', err)
            );
          }
        });
        ps.forEach((p) => {
          const value = editP.get(p.id);
          if (value !== undefined && value.trim() !== '' && value !== p.display_name) {
            updateParticipant(sid, p.id, { display_name: value.trim() }).catch((err) =>
              console.warn('Failed to save participant name on leave:', err)
            );
          }
        });
      };
    }, [])
  );

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

  const handleDeleteSession = () => {
    if (!id || !isOwner) return;
    Alert.alert(
      'Eliminar sesión',
      '¿Estás seguro? Se borrarán todos los participantes, bebidas y el historial. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSession(id);
              router.replace('/');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar la sesión');
            }
          },
        },
      ]
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

      {(Platform.OS === 'ios' || Platform.OS === 'android') && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.manageSubscriptionRow}
            onPress={async () => {
              const err = await presentCustomerCenter();
              if (err?.error) Alert.alert('Error', err.error);
            }}
          >
            <Ionicons name="card-outline" size={22} color="#007AFF" />
            <Text style={styles.manageSubscriptionText}>One More! Pro – Gestionar suscripción</Text>
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      )}

      {isOwner && (
        <View style={styles.deleteSection}>
          <TouchableOpacity style={styles.deleteSessionButton} onPress={handleDeleteSession}>
            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
            <Text style={[styles.deleteSessionButtonText, { marginLeft: 8 }]}>Eliminar sesión</Text>
          </TouchableOpacity>
        </View>
      )}
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
  manageSubscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  manageSubscriptionText: {
    flex: 1,
    marginLeft: 12,
    color: '#FFFFFF',
    fontSize: 17,
  },
  deleteSection: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  deleteSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  deleteSessionButtonText: {
    color: '#FF3B30',
    fontSize: 17,
    fontWeight: '600',
  },
});
