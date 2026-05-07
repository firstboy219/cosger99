// src/components/InputHutangSheet.tsx
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
import { Field, Input, PrimaryButton, Chip } from './UI';
import { colors, spacing, radius, typography } from '../theme';
import { createItem } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { formatNumberInput, parseNumeric } from '../utils/format';

const LOAN_TYPES: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'KPR', label: 'KPR', icon: 'home-outline' },
  { id: 'KKB', label: 'Kendaraan', icon: 'car-outline' },
  { id: 'KTA', label: 'Pinjaman Pribadi', icon: 'wallet-outline' },
  { id: 'CC', label: 'Kartu Kredit', icon: 'card-outline' },
  { id: 'STUDENT', label: 'Pendidikan', icon: 'school-outline' },
  { id: 'BUSINESS', label: 'Bisnis', icon: 'briefcase-outline' },
  { id: 'OTHER', label: 'Lainnya', icon: 'ellipsis-horizontal-circle-outline' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export const InputHutangSheet: React.FC<Props> = ({ visible, onClose }) => {
  const { user, patchData } = useApp();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('KPR');
  const [bankName, setBankName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [tenor, setTenor] = useState('');
  const [dueDate, setDueDate] = useState('5');

  const reset = () => {
    setName('');
    setType('KPR');
    setBankName('');
    setPrincipal('');
    setMonthlyPayment('');
    setInterestRate('');
    setTenor('');
    setDueDate('5');
  };

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('Validasi', 'Nama hutang wajib diisi');
      return;
    }
    const principalNum = parseNumeric(principal);
    const monthlyNum = parseNumeric(monthlyPayment);
    const tenorNum = parseInt(tenor || '0', 10);
    const interestNum = parseFloat(interestRate || '0');
    const dueDateNum = parseInt(dueDate || '5', 10);

    if (principalNum <= 0) {
      Alert.alert('Validasi', 'Pokok pinjaman harus lebih dari 0');
      return;
    }
    if (monthlyNum <= 0) {
      Alert.alert('Validasi', 'Cicilan bulanan harus lebih dari 0');
      return;
    }
    if (tenorNum <= 0) {
      Alert.alert('Validasi', 'Tenor (bulan) harus lebih dari 0');
      return;
    }

    const now = new Date();
    const startDate = now.toISOString();
    const end = new Date(now);
    end.setMonth(end.getMonth() + tenorNum);

    const item: any = {
      id: `debt-${Date.now()}`,
      userId: user.id,
      name: name.trim(),
      type,
      bankName: bankName.trim() || undefined,
      originalPrincipal: principalNum,
      remainingPrincipal: principalNum,
      totalLiability: monthlyNum * tenorNum,
      monthlyPayment: monthlyNum,
      interestRate: interestNum,
      remainingMonths: tenorNum,
      dueDate: dueDateNum,
      startDate,
      endDate: end.toISOString(),
      createdAt: startDate,
      updatedAt: startDate,
    };

    setLoading(true);
    try {
      const res = await createItem('debts', item);
      const saved = res?.data || res || item;
      patchData('debts', saved, 'add');
      reset();
      onClose();
    } catch (e: any) {
      Alert.alert('Gagal Simpan', e?.message || 'Terjadi kesalahan saat menyimpan hutang');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} testID="hutang-sheet">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Input Hutang</Text>
            <Text style={styles.subtitle}>Catat hutang baru yang akan kamu lunasi</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="hutang-close">
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <Field label="JENIS HUTANG">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {LOAN_TYPES.map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setType(t.id)}
                style={[styles.typeChip, type === t.id && styles.typeChipActive]}
                testID={`hutang-type-${t.id}`}
              >
                <Ionicons
                  name={t.icon}
                  size={16}
                  color={type === t.id ? colors.textInverse : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.typeChipText,
                    type === t.id && { color: colors.textInverse },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Field>

        <Field label="NAMA HUTANG">
          <Input
            testID="hutang-name-input"
            value={name}
            onChangeText={setName}
            placeholder="Contoh: KPR Rumah Pertama"
          />
        </Field>

        <Field label="NAMA BANK / KREDITUR">
          <Input
            testID="hutang-bank-input"
            value={bankName}
            onChangeText={setBankName}
            placeholder="Opsional · BCA, Mandiri, dll"
          />
        </Field>

        <Field label="POKOK PINJAMAN (Rp)">
          <Input
            testID="hutang-principal-input"
            value={principal ? formatNumberInput(principal) : ''}
            onChangeText={(v) => setPrincipal(String(parseNumeric(v)))}
            placeholder="500.000.000"
            keyboardType="number-pad"
          />
        </Field>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Field label="CICILAN/BULAN (Rp)" style={{ flex: 1 }}>
            <Input
              testID="hutang-monthly-input"
              value={monthlyPayment ? formatNumberInput(monthlyPayment) : ''}
              onChangeText={(v) => setMonthlyPayment(String(parseNumeric(v)))}
              placeholder="3.500.000"
              keyboardType="number-pad"
            />
          </Field>
          <Field label="TENOR (BULAN)" style={{ width: 120 }}>
            <Input
              testID="hutang-tenor-input"
              value={tenor}
              onChangeText={(v) => setTenor(v.replace(/[^\d]/g, ''))}
              placeholder="120"
              keyboardType="number-pad"
            />
          </Field>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Field label="BUNGA / TAHUN (%)" style={{ flex: 1 }}>
            <Input
              testID="hutang-interest-input"
              value={interestRate}
              onChangeText={(v) => setInterestRate(v.replace(/[^\d.]/g, ''))}
              placeholder="6.5"
              keyboardType="decimal-pad"
            />
          </Field>
          <Field label="JATUH TEMPO (Tgl)" style={{ width: 120 }}>
            <Input
              testID="hutang-duedate-input"
              value={dueDate}
              onChangeText={(v) => setDueDate(v.replace(/[^\d]/g, '').slice(0, 2))}
              placeholder="5"
              keyboardType="number-pad"
            />
          </Field>
        </View>

        <PrimaryButton
          label="Simpan Hutang"
          onPress={handleSave}
          loading={loading}
          icon="checkmark-circle-outline"
          style={{ marginTop: spacing.md, marginBottom: Platform.OS === 'web' ? spacing.lg : 0 }}
          testID="hutang-save-button"
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
  typeChip: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: { ...typography.bodySm, color: colors.textSecondary, fontWeight: '600' },
});

export default InputHutangSheet;
