// src/components/Charts.tsx
// Lightweight charts using react-native-svg.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G, Path, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors, spacing, radius, typography } from '../theme';
import { formatCurrency } from '../utils/format';

// ─── DonutChart ───────────────────────────────────────────────────────────
export const DonutChart: React.FC<{
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}> = ({ data, size = 160, thickness = 22, centerLabel, centerValue }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;

  let acc = 0;
  const segments = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const fraction = d.value / total;
      const start = acc;
      acc += fraction;
      const dasharray = `${c * fraction} ${c}`;
      const dashoffset = -c * start;
      return { d, dasharray, dashoffset };
    });

  if (total === 0) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={colors.border}
            strokeWidth={thickness}
            fill="transparent"
          />
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{ ...typography.bodySm, color: colors.textDisabled, fontSize: 11 }}>
            {centerLabel || 'Tidak ada data'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={cx} originY={cy}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={colors.border}
            strokeWidth={thickness}
            fill="transparent"
          />
          {segments.map((s, idx) => (
            <Circle
              key={idx}
              cx={cx}
              cy={cy}
              r={r}
              stroke={s.d.color}
              strokeWidth={thickness}
              fill="transparent"
              strokeDasharray={s.dasharray}
              strokeDashoffset={s.dashoffset}
              strokeLinecap="butt"
            />
          ))}
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {centerValue ? (
          <Text style={{ ...typography.h4, color: colors.textPrimary, fontWeight: '800' }}>
            {centerValue}
          </Text>
        ) : null}
        {centerLabel ? (
          <Text style={{ ...typography.bodySm, color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
            {centerLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

// ─── HorizontalBars ───────────────────────────────────────────────────
export const HorizontalBars: React.FC<{
  data: { label: string; value: number; color?: string }[];
  formatValue?: (n: number) => string;
}> = ({ data, formatValue = (n) => formatCurrency(n) }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ gap: 12 }}>
      {data.map((d, idx) => {
        const pct = (d.value / max) * 100;
        const color = d.color || colors.primary;
        return (
          <View key={idx}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ ...typography.bodySm, color: colors.textPrimary, fontWeight: '600' }}>
                {d.label}
              </Text>
              <Text style={{ ...typography.bodySm, color: colors.textSecondary, fontWeight: '700' }}>
                {formatValue(d.value)}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ─── MiniSparkline (for trend) ────────────────────────────────────────
export const MiniSparkline: React.FC<{
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}> = ({ values, width = 220, height = 56, color = colors.primary }) => {
  if (values.length < 2) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ ...typography.bodySm, color: colors.textDisabled }}>
          Data belum cukup
        </Text>
      </View>
    );
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');
  const path = `M ${points.split(' ').join(' L ')}`;

  // Build closed area path for fill
  const areaPath = `${path} L ${width},${height} L 0,${height} Z`;
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Path d={areaPath} fill={color} fillOpacity={0.12} />
        <Path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  barTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.pill },
});

export default { DonutChart, HorizontalBars, MiniSparkline };
