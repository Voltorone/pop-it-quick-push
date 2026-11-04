import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export const GAME_MODES = [
  {
    id: 'memory',
    name: 'MODO MEMORIA',
    shortName: 'MEMORIA',
    subtitle: 'Observa la secuencia aleatoria y repítela en orden',
    ledColor: '#00f5d4',
  },
  {
    id: 'reflex',
    name: 'MODO REFLEJOS',
    shortName: 'REFLEJOS',
    subtitle: 'Explota todas las bolas iluminadas antes de que acabe el tiempo',
    ledColor: '#ffbe0b',
  },
  {
    id: 'timeattack',
    name: 'CONTRARRELOJ 60s',
    shortName: 'RELOJ 60s',
    subtitle: 'Explota y reinicia con el gatillo tantas rondas como puedas en 60s',
    ledColor: '#ff5d8f',
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
  statusText,
  timerProgress,
  timeLeftSeconds,
}) {
  const currentMode = GAME_MODES[modeIndex];

  const getVolumeIcon = () => {
    if (volumeLevel === 0) return '🔇';
    if (volumeLevel === 1) return '🔈';
    if (volumeLevel === 2) return '🔉';
    return '🔊';
  };

  return (
    <View style={styles.headerContainer}>
      {/* 3 Physical Top Buttons matching the ALE-HOP console */}
      <View style={styles.topButtonsRow}>
        {/* Mode Button */}
        <View style={styles.buttonWrapper}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.physicalButton,
              !isPoweredOn && styles.physicalButtonDisabled,
            ]}
            onPress={onCycleMode}
          >
            <View style={styles.buttonInnerRing}>
              <Text style={styles.buttonSymbol}>☰</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.buttonLabel}>MODO</Text>
        </View>

        {/* Power Button (Slightly central & prominent) */}
        <View style={styles.buttonWrapper}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.physicalButton,
              styles.powerButton,
              isPoweredOn && styles.powerButtonActive,
            ]}
            onPress={onTogglePower}
          >
            <View
              style={[
                styles.buttonInnerRing,
                isPoweredOn && styles.powerInnerRingActive,
              ]}
            >
              <Text
                style={[
                  styles.buttonSymbol,
                  isPoweredOn && styles.powerSymbolActive,
                ]}
              >
                ⏻
              </Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.buttonLabel}>ON / OFF</Text>
        </View>

        {/* Volume Button */}
        <View style={styles.buttonWrapper}>
          <TouchableOpacity
            activeOpacity={0.75}
            style={[
              styles.physicalButton,
              !isPoweredOn && styles.physicalButtonDisabled,
            ]}
            onPress={onCycleVolume}
          >
            <View style={styles.buttonInnerRing}>
              <Text style={styles.buttonSymbol}>{getVolumeIcon()}</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.buttonLabel}>
            VOL {volumeLevel === 0 ? 'OFF' : volumeLevel}
          </Text>
        </View>
      </View>

      {/* Digital LED Screen Panel */}
      <View style={[styles.ledScreen, !isPoweredOn && styles.ledScreenOff]}>
        {isPoweredOn ? (
          <>
            <View style={styles.ledTopRow}>
              <View
                style={[
                  styles.modeBadge,
                  { borderColor: currentMode.ledColor },
                ]}
              >
                <Text
                  style={[styles.modeBadgeText, { color: currentMode.ledColor }]}
                >
                  {currentMode.shortName}
                </Text>
              </View>

              <View style={styles.statsGroup}>
                {currentMode.id === 'timeattack' ? (
                  <Text style={styles.timerReadout}>⏱ {timeLeftSeconds}s</Text>
                ) : (
                  <Text style={styles.levelReadout}>
                    NVL {String(level).padStart(2, '0')}{' '}
                    <Text style={styles.subRoundReadout}>
                      ({subRound}/{totalSubRounds})
                    </Text>
                  </Text>
                )}
              </View>

              <View style={styles.livesContainer}>
                {currentMode.id === 'timeattack' ? (
                  <Text style={styles.scoreReadout}>★ {score}</Text>
                ) : (
                  <Text style={styles.heartsText}>
                    {'♥'.repeat(Math.max(0, lives))}
                    <Text style={styles.heartsLost}>
                      {'♡'.repeat(Math.max(0, 3 - lives))}
                    </Text>
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.ledBottomRow}>
              <Text style={styles.statusMessage} numberOfLines={1}>
                {statusText}
              </Text>
              <Text style={styles.highScoreText}>
                PTS: {score} | RÉCORD: {highScore}
              </Text>
            </View>

            {/* Timer bar for Reflex / Time Attack / Memory countdown */}
            <View style={styles.timerBarTrack}>
              <View
                style={[
                  styles.timerBarFill,
                  {
                    width: `${Math.max(0, Math.min(100, timerProgress * 100))}%`,
                    backgroundColor:
                      timerProgress < 0.28
                        ? '#ff3366'
                        : timerProgress < 0.55
                        ? '#ffbe0b'
                        : currentMode.ledColor,
                  },
                ]}
              />
            </View>
          </>
        ) : (
          <View style={styles.ledOffContent}>
            <Text style={styles.ledOffText}>
              CONSOLA APAGADA • PULSA ⏻ PARA JUGAR
            </Text>
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
    marginBottom: 10,
  },
  topButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 22,
    marginBottom: 10,
  },
  buttonWrapper: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  physicalButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3c390',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#d99b66',
    shadowColor: '#6b384c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 5,
  },
  physicalButtonDisabled: {
    opacity: 0.7,
  },
  powerButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  powerButtonActive: {
    borderColor: '#ff5d8f',
    shadowColor: '#ff5d8f',
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  buttonInnerRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#9c6234',
    backgroundColor: '#f7cfa4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  powerInnerRingActive: {
    backgroundColor: '#ffe5ec',
    borderColor: '#d9386a',
  },
  buttonSymbol: {
    fontSize: 17,
    fontWeight: '800',
    color: '#6e3f19',
  },
  powerSymbolActive: {
    color: '#d90429',
  },
  buttonLabel: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '800',
    color: '#8a3a5b',
    letterSpacing: 0.6,
  },
  ledScreen: {
    width: '94%',
    backgroundColor: '#1d1526',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 3,
    borderColor: '#d87fa1',
    minHeight: 68,
    justifyContent: 'space-between',
  },
  ledScreenOff: {
    backgroundColor: '#261e2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ledTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeBadge: {
    borderWidth: 1.2,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  statsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelReadout: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  subRoundReadout: {
    color: '#a99bb8',
    fontSize: 11,
    fontWeight: '700',
  },
  timerReadout: {
    color: '#ffbe0b',
    fontSize: 15,
    fontWeight: '900',
  },
  livesContainer: {
    minWidth: 52,
    alignItems: 'flex-end',
  },
  heartsText: {
    color: '#ff3366',
    fontSize: 15,
    letterSpacing: 2,
  },
  heartsLost: {
    color: '#594a66',
  },
  scoreReadout: {
    color: '#00f5d4',
    fontSize: 14,
    fontWeight: '900',
  },
  ledBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 5,
  },
  statusMessage: {
    color: '#f8f9fa',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  highScoreText: {
    color: '#b8a9c9',
    fontSize: 10,
    fontWeight: '800',
  },
  timerBarTrack: {
    width: '100%',
    height: 5,
    backgroundColor: '#352844',
    borderRadius: 3,
    overflow: 'hidden',
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  ledOffContent: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ledOffText: {
    color: '#756285',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
