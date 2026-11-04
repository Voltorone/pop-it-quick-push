import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export const GAME_MODES = [
  {
    id: 'memory',
    icon: '◎',
    ledColor: '#00f0ff',
  },
  {
    id: 'reflex',
    icon: '⚡',
    ledColor: '#ffb800',
  },
  {
    id: 'timeattack',
    icon: '⏱',
    ledColor: '#ff2a6d',
  },
];

export default function ConsoleHeader({
  isPoweredOn,
  modeIndex,
  volumeLevel,
  onTogglePower,
  onCycleMode,
  onCycleVolume,
  level,
  subRound,
  totalSubRounds,
  score,
  highScore,
  lives,
  gameState,
  timerProgress,
  timeLeftSeconds,
}) {
  const currentMode = GAME_MODES[modeIndex];

  const getStateIcon = () => {
    if (!isPoweredOn) return '⏻';
    if (gameState === 'showing') return '👁';
    if (gameState === 'playing') return '👆';
    if (gameState === 'awaiting_trigger') return '⏫';
    if (gameState === 'gameover') return '↺';
    return '▶';
  };

  return (
    <View style={styles.headerContainer}>
      {/* Minimalist Top Hardware Controls (Icon-Only) */}
      <View style={styles.topButtonsRow}>
        {/* Mode Selector Button with 3 mode indicator dots */}
        <View style={styles.controlItem}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.iconButton,
              isPoweredOn && { borderColor: currentMode.ledColor },
            ]}
            onPress={onCycleMode}
          >
            <Text
              style={[
                styles.iconText,
                isPoweredOn && { color: currentMode.ledColor },
              ]}
            >
              {currentMode.icon}
            </Text>
          </TouchableOpacity>
          <View style={styles.dotsRow}>
            {GAME_MODES.map((m, idx) => (
              <View
                key={m.id}
                style={[
                  styles.microDot,
                  isPoweredOn &&
                    idx === modeIndex && {
                      backgroundColor: m.ledColor,
                    },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Power Button */}
        <View style={styles.controlItem}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.iconButton,
              styles.powerButton,
              isPoweredOn && styles.powerButtonActive,
            ]}
            onPress={onTogglePower}
          >
            <Text
              style={[
                styles.iconText,
                isPoweredOn ? styles.powerIconActive : styles.powerIconOff,
              ]}
            >
              ⏻
            </Text>
          </TouchableOpacity>
          <View
            style={[
              styles.powerLed,
              isPoweredOn && { backgroundColor: '#00f59b' },
            ]}
          />
        </View>

        {/* Volume Button with 3 level dots */}
        <View style={styles.controlItem}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={styles.iconButton}
            onPress={onCycleVolume}
          >
            <Text style={[styles.iconText, !isPoweredOn && styles.iconDisabled]}>
              {volumeLevel === 0 ? '🔇' : '🔊'}
            </Text>
          </TouchableOpacity>
          <View style={styles.dotsRow}>
            {[1, 2, 3].map((v) => (
              <View
                key={v}
                style={[
                  styles.microDot,
                  isPoweredOn &&
                    volumeLevel >= v && {
                      backgroundColor: '#e2e8f0',
                    },
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Ultra-Clean Minimalist OLED Status Bar */}
      <View style={[styles.oledPanel, !isPoweredOn && styles.oledPanelOff]}>
        {isPoweredOn ? (
          <>
            <View style={styles.oledMainRow}>
              {/* Left: Level + 5 Sub-Round Dots (or Timer) */}
              <View style={styles.levelBlock}>
                {currentMode.id === 'timeattack' ? (
                  <Text style={[styles.bigDigits, { color: currentMode.ledColor }]}>
                    {String(timeLeftSeconds).padStart(2, '0')}s
                  </Text>
                ) : (
                  <>
                    <Text style={styles.bigDigits}>
                      {String(level).padStart(2, '0')}
                    </Text>
                    <View style={styles.roundDotsCol}>
                      {Array.from({ length: totalSubRounds }).map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.roundDot,
                            i < subRound && {
                              backgroundColor: currentMode.ledColor,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  </>
                )}
              </View>

              {/* Center: Intuitive State Cue Icon */}
              <View style={styles.centerCue}>
                <Text style={styles.stateIcon}>{getStateIcon()}</Text>
              </View>

              {/* Right: Lives Diamonds & Score */}
              <View style={styles.rightStats}>
                {currentMode.id !== 'timeattack' && (
                  <View style={styles.livesRow}>
                    {[0, 1, 2].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.lifeDiamond,
                          i < lives && styles.lifeDiamondActive,
                        ]}
                      />
                    ))}
                  </View>
                )}
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreVal}>{score}</Text>
                  <Text style={styles.highScoreVal}>🏆 {highScore}</Text>
                </View>
              </View>
            </View>

            {/* Minimalist Progress Line */}
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.max(0, Math.min(100, timerProgress * 100))}%`,
                    backgroundColor:
                      timerProgress < 0.25
                        ? '#ff2a6d'
                        : currentMode.ledColor,
                  },
                ]}
              />
            </View>
          </>
        ) : (
          <View style={styles.offStateRow}>
            <View style={styles.offLine} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  topButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '78%',
    marginBottom: 14,
  },
  controlItem: {
    alignItems: 'center',
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#232733',
    borderWidth: 1.5,
    borderColor: '#363c4e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  powerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  powerButtonActive: {
    borderColor: '#475069',
    backgroundColor: '#282d3b',
  },
  iconText: {
    fontSize: 18,
    color: '#cbd5e1',
    fontWeight: '700',
  },
  iconDisabled: {
    opacity: 0.3,
  },
  powerIconActive: {
    color: '#f8fafc',
  },
  powerIconOff: {
    color: '#475569',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
  },
  microDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#2d3343',
  },
  powerLed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2d3343',
    marginTop: 6,
  },
  oledPanel: {
    width: '92%',
    backgroundColor: '#0f1117',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#262a36',
    minHeight: 62,
    justifyContent: 'space-between',
  },
  oledPanelOff: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  oledMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 75,
  },
  bigDigits: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  roundDotsCol: {
    flexDirection: 'row',
    gap: 4,
  },
  roundDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#262b38',
  },
  centerCue: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#181b24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateIcon: {
    fontSize: 17,
  },
  rightStats: {
    alignItems: 'flex-end',
    minWidth: 75,
  },
  livesRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  lifeDiamond: {
    width: 7,
    height: 7,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    backgroundColor: '#262b38',
  },
  lifeDiamondActive: {
    backgroundColor: '#ff2a6d',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreVal: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  highScoreVal: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: '#1e222d',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  offStateRow: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 14,
  },
  offLine: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#1e222d',
  },
});
