// src/components/BottomSheet.tsx
// Simple cross-platform modal with bottom sheet vibe.
// Avoids @gorhom/bottom-sheet dependency (which has web compat issues) — uses RN Modal.
import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { colors, radius } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number | string;
  testID?: string;
};

export const BottomSheet: React.FC<Props> = ({ visible, onClose, children, height, testID }) => {
  const translate = useRef(new Animated.Value(800)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translate, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translate.setValue(800);
      opacity.setValue(0);
    }
  }, [visible, translate, opacity]);

  const screenH = Dimensions.get('window').height;
  const sheetMaxHeight =
    typeof height === 'number'
      ? height
      : typeof height === 'string'
      ? height
      : Math.min(screenH * 0.92, 760);

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>
      <KeyboardAvoidingView
        style={styles.kbWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View
          testID={testID}
          style={[
            styles.sheet,
            { maxHeight: sheetMaxHeight as any, transform: [{ translateY: translate }] },
          ]}
        >
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45,49,42,0.45)',
  },
  kbWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 20,
    minHeight: 240,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
});

export default BottomSheet;
