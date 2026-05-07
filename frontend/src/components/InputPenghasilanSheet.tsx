// src/components/InputPenghasilanSheet.tsx
import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from './BottomSheet';
import { Field, Input, PrimaryButton } from './UI';
import { colors, spacing, radius, typography } from '../theme';
import { createItem } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { formatNumberInput, parseNumeric } from '../utils/format';

const TYPES = [
  { id: 'active', label: 'Aktif', desc: 'Gaji, freelance', icon: 'briefcase-outline' as const },
  { id: 'passive', label: 'Pasif', desc: 'Sewa, dividen', icon: 'leaf-outline' as const },
  { id: 'windfall', label: 'Bonus', desc: 'THR, bonus', icon: 'gift-outline' as const },
];

const FREQUENCIES = [
  { id: 'monthly', label: 'Bulanan' },
  { id: 'one-time', label: 'Sekali' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export const InputPenghasilanSheet: React.FC<Props> = ({ visible, onClose }) => {
  const { user, patchData } = useApp();
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'active' | 'passive' | 'windfall'>('active');
  const [frequency, setFrequency] = useState<'monthly' | 'one-time'>('monthly');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setSource('');
    setAmount('');
    setType('active');
    setFrequency('monthly');
    setNotes('');
  };

  const handleSave = async () => {
    if (!user) return;
    if (!source.trim()) {
      Alert.alert('Validasi', 'Sumber penghasilan wajib diisi');
      return;
    }
    const amountNum = parseNumeric(amount);
    if (amountNum <= 0) {
      Alert.alert('Validasi', 'Jumlah harus lebih dari 0');
      return;
    }
    const today = new Date();
    const dateReceived = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(today.getDate()).padStart(2, '0')}`;
    const item: any = {
      id: `inc-${Date.now()}`,
      userId: user.id,
      source: source.trim(),
      amount: amountNum,
      type,
      frequency,
      dateReceived,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLoading(true);
    try {
      const res = await createItem('incomes', item);
      const saved = res?.data || res || item;
      patchData('incomes', saved, 'add');
      reset();
      onClose();
    } catch (e: any) {
      Alert.alert('Gagal Simpan', e?.message || 'Terjadi kesalahan saat menyimpan penghasilan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="income-sheet">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Input Penghasilan</Text>
            <Text style={styles.subtitle}>Catat sumber pemasukan kamu</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="income-close">
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <Field label="JENIS PENGHASILAN">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setType(t.id as any)}
                activeOpacity={0.85}
                style={[styles.typeCard, type === t.id && styles.typeCardActive]}
                testID={`income-type-${t.id}`}
              >
                <Ionicons
                  name={t.icon}
                  size={20}
                  color={type === t.id ? colors.surface : colors.primary}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    type === t.id && { color: colors.surface },
                  ]}
                >
                  {t.label}
                </Text>
                <Text
                  style={[
                    styles.typeDesc,
                    type === t.id && { color: colors.surface, opacity: 0.85 },
                  ]}
                >
                  {t.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="SUMBER">
          <Input
            testID="income-source-input"
            value={source}
            onChangeText={setSource}
            placeholder="Contoh: Gaji PT ABC"
          />
        </Field>

        <Field label="JUMLAH (Rp)">
          <Input
            testID="income-amount-input"
            value={amount ? formatNumberInput(amount) : ''}
            onChangeText={(v) => setAmount(String(parseNumeric(v)))}
            placeholder="10.000.000"
            keyboardType="number-pad"
          />
        </Field>

        <Field label="FREKUENSI">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {FREQUENCIES.map((f) => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFrequency(f.id as any)}
                style={[styles.freqChip, frequency === f.id && styles.freqChipActive]}
                testID={`income-freq-${f.id}`}
              >
                <Text
                  style={[
                    styles.freqText,
                    frequency === f.id && { color: colors.textInverse },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="CATATAN">
          <Input
            testID="income-notes-input"
            value={notes}
            onChangeText={setNotes}
            placeholder="Opsional"
            multiline
            numberOfLines={2}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
        </Field>

        <PrimaryButton
          label="Simpan Penghasilan"
          onPress={handleSave}
          loading={loading}
          icon="checkmark-circle-outline"
          style={{ marginTop: spacing.md, marginBottom: Platform.OS === 'web' ? spacing.lg : 0 }}
          testID="income-save-button"
        />
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, color: colors.textPrimary },
  subtitle: { ...typography.bodyMd, color: colors.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    gap: 4,
  },
  typeCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeLabel: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
  typeDesc: { ...typography.bodySm, color: colors.textSecondary, fontSize: 11 },
  freqChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  freqChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  freqText: { ...typography.bodyMd, color: colors.textPrimary, fontWeight: '600' },
});

export default InputPenghasilanSheet;
