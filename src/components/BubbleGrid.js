import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

// Exact 3-4-3 bubble layout from the ALE-HOP Pop-It console image
const ROWS = [
  [0, 1, 2],       // Top row: 3 bubbles
  [3, 4, 5, 6],    // Middle row: 4 bubbles
  [7, 8, 9],       // Bottom row: 3 bubbles
];

const NOTE_LABELS = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI', 'DO⁺', 'RE⁺', 'MI⁺'];

export default function BubbleGrid({
  litBubbles,
  poppedBubbles,
  errorBubbles,
  onPressBubble,
  disabled,
  isPoweredOn,
  accentLedColor = '#4eff5e',
}) {
  return (
    <View style={styles.siliconeTrayOuter}>
      <View style={styles.siliconeTrayInner}>
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
                          backgroundColor: '#fff6b3',
                          borderColor: accentLedColor,
                          shadowColor: accentLedColor,
                        },
                      ],
                      isError && styles.bubbleDomeError,
                    ]}
                  >
                    {/* Internal LED glow core */}
                    {isLit && (
                      <View
                        style={[
                          styles.ledCoreGlow,
                          { backgroundColor: accentLedColor },
                        ]}
                      />
                    )}

                    {/* Error LED flash */}
                    {isError && <View style={styles.ledErrorGlow} />}

                    {/* 3D Silicone Specular Highlight (shifts when popped vs unpopped) */}
                    <View
                      style={[
                        styles.specularHighlight,
                        isPopped && styles.specularHighlightPopped,
                        isLit && styles.specularHighlightLit,
                      ]}
                    />

                    {/* Subtle musical note / bubble number indicator */}
                    <Text
                      style={[
                        styles.bubbleNoteLabel,
                        isLit && styles.bubbleNoteLabelLit,
                        isPopped && styles.bubbleNoteLabelPopped,
                      ]}
                    >
                      {NOTE_LABELS[bubbleIdx]}
                    </Text>
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
  siliconeTrayOuter: {
    width: '96%',
    backgroundColor: '#d9985f',
    borderRadius: 68,
    padding: 8,
    borderWidth: 4,
    borderColor: '#b8763e',
    shadowColor: '#4a1c30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  siliconeTrayInner: {
    backgroundColor: '#e8aa74',
    borderRadius: 60,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#f5c496',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  socketRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#d18d54',
    borderWidth: 3,
    borderColor: '#b5713a',
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5c3312',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  bubbleDome: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#f4c28c',
    borderWidth: 2.5,
    borderColor: '#fbe0c2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#754217',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
    elevation: 5,
    position: 'relative',
  },
  bubbleDomePopped: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#c9854d',
    borderColor: '#9e602d',
    borderWidth: 3,
    transform: [{ scale: 0.92 }],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    elevation: 1,
  },
  bubbleDomeLit: {
    borderWidth: 3.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 14,
    elevation: 12,
    transform: [{ scale: 1.04 }],
  },
  bubbleDomeError: {
    backgroundColor: '#ffccd5',
    borderColor: '#ff0033',
    borderWidth: 3.5,
    shadowColor: '#ff0033',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 14,
    elevation: 12,
  },
  ledCoreGlow: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    opacity: 0.55,
  },
  ledErrorGlow: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ff0033',
    opacity: 0.65,
  },
  specularHighlight: {
    position: 'absolute',
    top: 7,
    left: 11,
    width: 18,
    height: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 250, 240, 0.58)',
    transform: [{ rotate: '-20deg' }],
  },
  specularHighlightPopped: {
    top: 34,
    left: 18,
    width: 14,
    height: 6,
    backgroundColor: 'rgba(255, 235, 210, 0.22)',
  },
  specularHighlightLit: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  bubbleNoteLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(122, 68, 25, 0.45)',
    marginTop: 14,
  },
  bubbleNoteLabelLit: {
    color: '#4a2500',
    fontWeight: '900',
  },
  bubbleNoteLabelPopped: {
    color: 'rgba(70, 35, 10, 0.4)',
    marginTop: 0,
  },
});
