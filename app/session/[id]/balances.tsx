import { View, Text, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { Participant, DrinkEvent, DrinkType } from '@/types/database';
import { loadSessionData, updateDrinkType, upsertParticipantBalances } from '@/repo/sessions';
import { formatCurrencyEUR } from '@/utils/currency';

function getParticipantDrinkCount(events: DrinkEvent[], participantId: string): number {
  const participantEvents = events.filter((e) => e.target_participant_id === participantId);
  return participantEvents.reduce((sum, e) => sum + e.delta, 0);
}

function getParticipantDrinkTypeCount(events: DrinkEvent[], participantId: string, drinkTypeId: string): number {
  const participantEvents = events.filter(
    (e) => e.target_participant_id === participantId && e.drink_type_id === drinkTypeId
  );
  return participantEvents.reduce((sum, e) => sum + e.delta, 0);
}

function getInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name.trim()[0] || '?').toUpperCase();
}

function parsePrice(value: string): number {
  const parsed = parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default function BalancesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [events, setEvents] = useState<DrinkEvent[]>([]);
  const [drinkTypes, setDrinkTypes] = useState<DrinkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [priceByDrinkType, setPriceByDrinkType] = useState<Map<string, string>>(new Map());
  const [savingPriceFor, setSavingPriceFor] = useState<string | null>(null);
  const latestForCleanup = useRef<{
    priceByDrinkType: Map<string, string>;
    drinkTypes: DrinkType[];
    id: string | undefined;
    isOwner: boolean;
  }>({ priceByDrinkType: new Map(), drinkTypes: [], id: undefined, isOwner: false });

  useEffect(() => {
    latestForCleanup.current = {
      priceByDrinkType,
      drinkTypes,
      id,
      isOwner,
    };
  }, [priceByDrinkType, drinkTypes, id, isOwner]);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  useEffect(() => {
    if (drinkTypes.length === 0) return;
    setPriceByDrinkType((prev) => {
      const next = new Map(prev);
      drinkTypes.forEach((dt) => {
        if (!next.has(dt.id)) {
          next.set(dt.id, (dt.price_cents / 100).toFixed(2));
        }
      });
      return next;
    });
  }, [drinkTypes]);

  const loadData = async () => {
    if (!id) return;
    try {
      const data = await loadSessionData(id);
      setParticipants(data.participants);
      setEvents(data.events);
      setDrinkTypes(data.drinkTypes.sort((a, b) => a.sort_order - b.sort_order));
      setIsOwner(data.isOwner);
    } catch (error) {
      console.error('Failed to load balances:', error);
    } finally {
      setLoading(false);
    }
  };

  const setPriceForDrinkType = (drinkTypeId: string, value: string) => {
    setPriceByDrinkType((prev) => {
      const next = new Map(prev);
      next.set(drinkTypeId, value);
      return next;
    });
  };

  const savePriceToSupabase = async (drinkTypeId: string) => {
    if (!id || !isOwner) return;
    const value = priceByDrinkType.get(drinkTypeId) ?? '';
    const priceCents = Math.round(parsePrice(value) * 100);
    const dt = drinkTypes.find((d) => d.id === drinkTypeId);
    if (!dt || dt.price_cents === priceCents) return;

    setSavingPriceFor(drinkTypeId);
    try {
      await updateDrinkType(id, drinkTypeId, { price_cents: priceCents });
      setDrinkTypes((prev) =>
        prev.map((d) => (d.id === drinkTypeId ? { ...d, price_cents: priceCents } : d))
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar el precio');
      setPriceByDrinkType((prev) => {
        const next = new Map(prev);
        next.set(drinkTypeId, (dt.price_cents / 100).toFixed(2));
        return next;
      });
    } finally {
      setSavingPriceFor(null);
    }
  };

  const priceMap = useMemo(() => {
    const map = new Map<string, number>();
    drinkTypes.forEach((dt) => {
      map.set(dt.id, parsePrice(priceByDrinkType.get(dt.id) ?? '0'));
    });
    return map;
  }, [drinkTypes, priceByDrinkType]);

  const rows = useMemo(() => {
    return participants.map((p) => {
      const drinks = getParticipantDrinkCount(events, p.id);
      let amountEuros = 0;
      drinkTypes.forEach((dt) => {
        const count = getParticipantDrinkTypeCount(events, p.id, dt.id);
        amountEuros += count * (priceMap.get(dt.id) ?? 0);
      });
      return { participant: p, drinks, amountEuros };
    });
  }, [participants, events, drinkTypes, priceMap]);

  // Persist computed balances to Supabase whenever rows change (owner only)
  useEffect(() => {
    if (!id || !isOwner || rows.length === 0) return;
    const balances = rows.map((r) => ({
      participant_id: r.participant.id,
      amount_cents: Math.round(r.amountEuros * 100),
    }));
    upsertParticipantBalances(id, balances).catch((err) =>
      console.warn('Failed to persist balances:', err)
    );
  }, [id, isOwner, rows]);

  // Save any dirty prices when leaving the screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        const { priceByDrinkType: prices, drinkTypes: dts, id: sid, isOwner: owner } = latestForCleanup.current;
        if (!sid || !owner || dts.length === 0) return;
        dts.forEach((dt) => {
          const value = prices.get(dt.id) ?? '';
          const priceCents = Math.round(parsePrice(value) * 100);
          if (priceCents !== dt.price_cents) {
            updateDrinkType(sid, dt.id, { price_cents: priceCents }).catch((err) =>
              console.warn('Failed to save price on leave:', err)
            );
          }
        });
      };
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Precio por bebida</Text>
          {drinkTypes.length === 0 ? (
            <Text style={styles.emptyText}>No hay tipos de bebida en la sesión.</Text>
          ) : (
            drinkTypes.map((dt) => (
              <View key={dt.id} style={styles.drinkPriceRow}>
                <Text style={styles.drinkName}>
                  {dt.emoji} {dt.name}
                </Text>
                <View style={[styles.priceRow, !isOwner && styles.priceRowDisabled]}>
                  <TextInput
                    style={[styles.priceInput, !isOwner && styles.priceInputDisabled]}
                    value={priceByDrinkType.get(dt.id) ?? ''}
                    onChangeText={(value) => setPriceForDrinkType(dt.id, value)}
                    onBlur={() => savePriceToSupabase(dt.id)}
                    placeholder="0,00"
                    placeholderTextColor="#8E8E93"
                    keyboardType="decimal-pad"
                    editable={isOwner}
                  />
                  <Text style={styles.currencySuffix}>€</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lo que debe pagar cada uno</Text>
          {rows.length === 0 ? (
            <Text style={styles.emptyText}>Aún no hay participantes en la sesión.</Text>
          ) : (
            rows.map(({ participant, drinks, amountEuros }) => (
              <View key={participant.id} style={styles.card}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitial(participant.display_name)}</Text>
                </View>
                <View style={styles.cardCenter}>
                  <Text style={styles.name}>{participant.display_name}</Text>
                  <Text style={styles.drinksSubtext}>
                    {drinks} {drinks === 1 ? 'bebida' : 'bebidas'}
                  </Text>
                </View>
                <Text style={styles.amount}>
                  {formatCurrencyEUR(Math.round(amountEuros * 100))}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  scroll: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2C2C2E',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  drinkPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  drinkName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3C3C3E',
    paddingHorizontal: 12,
    minWidth: 100,
  },
  priceRowDisabled: {
    opacity: 0.8,
  },
  priceInput: {
    width: 72,
    color: '#FFFFFF',
    fontSize: 17,
    paddingVertical: 12,
  },
  priceInputDisabled: {
    opacity: 0.9,
  },
  currencySuffix: {
    color: '#8E8E93',
    fontSize: 17,
    fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3C3C3E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  cardCenter: {
    flex: 1,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  drinksSubtext: {
    color: '#8E8E93',
    fontSize: 15,
    marginTop: 2,
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 17,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 17,
    textAlign: 'center',
    marginTop: 32,
  },
});
