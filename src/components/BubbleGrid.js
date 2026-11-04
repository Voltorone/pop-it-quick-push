import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';

// 3-4-3 bubble layout
const ROWS = [
  [0, 1, 2],
  [3, 4, 5, 6],
  [7, 8, 9],
];

export default function BubbleGrid({
  litBubbles,
  poppedBubbles,
  errorBubbles,
  onPressBubble,
  disabled,
  isPoweredOn,
  accentLedColor = '#00f0ff',
}) {
  return (
    <View style={styles.padOuter}>
      <View style={styles.padInner}>
        {ROWS.map((rowIndices, rowIdx) => (
          <View key={`row-${rowIdx}`} style={styles.bubbleRow}>
            {rowIndices.map((bubbleIdx) => {
              const isLit = Boolean(litBubbles[bubbleIdx]);
              const isPopped = Boolean(poppedBubbles[bubbleIdx]);
              const isError = Boolean(errorBubbles[bubbleIdx]);

              return (
                <View key={`bubble-${bubbleIdx}`} style={styles.socketRing}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={disabled || !isPoweredOn}
                    onPress={() => onPressBubble(bubbleIdx)}
                    style={[
                      styles.bubbleDome,
                      isPopped && styles.bubbleDomePopped,
                      isLit && [
                        styles.bubbleDomeLit,
                        {
                          borderColor: accentLedColor,
                          shadowColor: accentLedColor,
                        },
                      ],
                      isError && styles.bubbleDomeError,
                    ]}
                  >
                    {/* Minimalist precision center ring */}
                    <View
                      style={[
                        styles.centerRing,
                        isPopped && styles.centerRingPopped,
                        isLit && {
                          borderColor: accentLedColor,
                          backgroundColor: accentLedColor,
                        },
                        isError && {
                          borderColor: '#ff2a6d',
                          backgroundColor: '#ff2a6d',
                        },
                      ]}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  padOuter: {
    width: '94%',
    backgroundColor: '#13161f',
    borderRadius: 56,
    padding: 8,
    borderWidth: 1.5,
    borderColor: '#252a38',
  },
  padInner: {
    backgroundColor: '#181c26',
    borderRadius: 48,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 5,
  },
  socketRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#11141c',
    borderWidth: 1.5,
    borderColor: '#222736',
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleDome: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#242938',
    borderWidth: 2,
    borderColor: '#353c52',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  bubbleDomePopped: {
    backgroundColor: '#161922',
    borderColor: '#1f2430',
    transform: [{ scale: 0.91 }],
    shadowOpacity: 0.1,
    elevation: 1,
  },
  bubbleDomeLit: {
    backgroundColor: '#2b3347',
    borderWidth: 2.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 14,
    elevation: 12,
    transform: [{ scale: 1.04 }],
  },
  bubbleDomeError: {
    backgroundColor: '#3b1826',
    borderColor: '#ff2a6d',
    borderWidth: 2.5,
    shadowColor: '#ff2a6d',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 14,
    elevation: 12,
  },
  centerRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3b435c',
    backgroundColor: 'transparent',
  },
  centerRingPopped: {
    borderColor: '#252a3a',
    transform: [{ scale: 0.85 }],
  },
});
