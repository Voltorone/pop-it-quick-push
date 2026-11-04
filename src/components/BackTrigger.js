import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function BackTrigger({
  isPoweredOn,
  gameState, // 'idle' | 'showing' | 'playing' | 'awaiting_trigger' | 'gameover'
  onPressTrigger,
  accentColor = '#00f0ff',
}) {
  const isReadyToConfirm = gameState === 'awaiting_trigger';
  const isIdleOrOver = gameState === 'idle' || gameState === 'gameover';

  const getIcon = () => {
    if (!isPoweredOn) return '—';
    if (gameState === 'idle') return '▶';
    if (gameState === 'gameover') return '↺';
    if (isReadyToConfirm) return '⏫';
    return '▲';
  };

  return (
    <View style={styles.footerContainer}>
      <TouchableOpacity
        activeOpacity={0.78}
        disabled={!isPoweredOn || gameState === 'showing'}
        onPress={onPressTrigger}
        style={[
          styles.triggerBar,
          !isPoweredOn && styles.triggerDisabled,
          isReadyToConfirm && {
            borderColor: accentColor,
            backgroundColor: '#1e2738',
            shadowColor: accentColor,
            shadowOpacity: 0.75,
            shadowRadius: 12,
          },
          isIdleOrOver &&
            isPoweredOn && {
              borderColor: accentColor,
              backgroundColor: '#222838',
            },
        ]}
      >
        <View style={styles.gripRow}>
          <View style={styles.gripPill} />
          <Text
            style={[
              styles.triggerIcon,
              (isReadyToConfirm || (isIdleOrOver && isPoweredOn)) && {
                color: accentColor,
              },
            ]}
          >
            {getIcon()}
          </Text>
          <View style={styles.gripPill} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 18,
  },
  triggerBar: {
    width: '86%',
    height: 54,
    backgroundColor: '#232734',
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: '#363c4e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
  triggerDisabled: {
    opacity: 0.35,
  },
  gripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  gripPill: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#383f52',
  },
  triggerIcon: {
    fontSize: 20,
    fontWeight: '800',
    color: '#94a3b8',
  },
});
