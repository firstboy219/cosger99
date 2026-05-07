// src/components/AIInsightCard.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { callAI, localInsight, AILimitError } from '../services/ai';
import { colors, spacing, radius, typography, shadows } from '../theme';

type Metrics = {
  dsr: number;
  totalDebt: number;
  totalIncome: number;
  monthlyObligation: number;
  emergencyFund?: number;
  debtCount: number;
};

const TONE_STYLES = {
  good: { bg: colors.primaryLight, fg: colors.primaryActive, icon: 'sparkles' as const },
  warning: { bg: colors.warningBg, fg: '#A16916', icon: 'warning' as const },
  danger: { bg: colors.dangerBg, fg: colors.danger, icon: 'alert-circle' as const },
};

export const AIInsightCard: React.FC<{ metrics: Metrics }> = ({ metrics }) => {
  const [loading, setLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const local = localInsight(metrics);
  const tone = TONE_STYLES[local.tone];

  const generate = useCallback(async () => {
    setLoading(true);
    setAiError(null);
    try {
      const result = await callAI({
        prompt: `Metrics finansial saya: total hutang Rp ${metrics.totalDebt.toLocaleString('id')}, cicilan/bln Rp ${metrics.monthlyObligation.toLocaleString('id')}, pemasukan/bln Rp ${metrics.totalIncome.toLocaleString('id')}, DSR ${metrics.dsr.toFixed(1)}%, jumlah hutang aktif ${metrics.debtCount}. Berikan saran personal max 2 kalimat singkat dalam bahasa Indonesia, fokus action konkret minggu ini.`,
        systemInstruction:
          'Anda adalah financial advisor untuk Indonesia (Paydone.id). Bahasa santai tapi profesional. Maks 2 kalimat. JANGAN sebutkan angka spesifik dari prompt — fokus aksi.',
      });
      setAiText(result.trim().slice(0, 320));
    } catch (e: any) {
      if (e instanceof AILimitError) {
        setAiError('AI Premium 🔒 — Upgrade untuk insight personal');
      } else {
        setAiError(e?.message || 'AI offline');
      }
    } finally {
      setLoading(false);
    }
  }, [metrics]);

  useEffect(() => {
    // Auto-generate once on mount when there's enough data
    if (metrics.debtCount > 0 || metrics.totalIncome > 0) {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headline = aiText ? 'Insight AI untukmu' : local.headline;
  const body = aiText || local.body;

  return (
    <View style={[styles.card, { backgroundColor: tone.bg }]} testID="ai-insight-card">
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: tone.fg }]}>
          <Ionicons name={tone.icon} size={16} color={colors.surface} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: tone.fg }]}>
            {aiText ? 'AI ANALYST · GEMINI' : 'INSIGHT FINANSIAL'}
          </Text>
        </View>
        <TouchableOpacity onPress={generate} disabled={loading} style={styles.refreshBtn} testID="ai-insight-refresh">
          {loading ? (
            <ActivityIndicator size="small" color={tone.fg} />
          ) : (
            <Ionicons name="refresh" size={16} color={tone.fg} />
          )}
        </TouchableOpacity>
      </View>
      <Text style={[styles.headline, { color: colors.textPrimary }]}>{headline}</Text>
      <Text style={styles.body}>{body}</Text>
      {aiError && (
        <View style={styles.errorRow}>
          <Ionicons name="information-circle-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.errorText}>{aiError}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.md + 4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...shadows.card,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typography.overline, fontSize: 10 },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    ...typography.bodyLg,
    fontWeight: '800',
    marginBottom: 4,
  },
  body: { ...typography.bodyMd, color: colors.textSecondary, lineHeight: 20 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  errorText: { ...typography.bodySm, color: colors.textSecondary, fontSize: 11 },
});

export default AIInsightCard;
