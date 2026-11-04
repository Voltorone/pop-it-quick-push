import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function BackTrigger({
  isPoweredOn,
  gameState, // 'idle' | 'showing' | 'playing' | 'awaiting_trigger' | 'gameover'
  onPressTrigger,
  poppedCount,
}) {
  const isReadyToConfirm = gameState === 'awaiting_trigger';
  const isIdleOrOver = gameState === 'idle' || gameState === 'gameover';

  let mainLabel = 'EMPUJAR GATILLO TRASERO';
  let subLabel = 'Levanta las burbujas y confirma la ronda';

  if (!isPoweredOn) {
    mainLabel = 'GATILLO TRASERO';
    subLabel = 'Enciende la consola (⏻) para empezar';
  } else if (gameState === 'idle') {
    mainLabel = '¡PULSA EL GATILLO PARA EMPEZAR!';
    subLabel = 'Genera una secuencia 100% aleatoria';
  } else if (gameState === 'gameover') {
    mainLabel = '¡REINTENTAR PARTIDA!';
    subLabel = 'Empuja las burbujas hacia arriba para jugar de nuevo';
  } else if (isReadyToConfirm) {
    mainLabel = '¡PULSA EL GATILLO AHORA! ⏫';
    subLabel = '¡Todas explotadas! Empújalas para pasar de ronda';
  } else if (gameState === 'showing') {
    mainLabel = 'OBSERVA LA SECUENCIA...';
    subLabel = 'Presta atención al orden y sonido de las luces';
  } else {
    mainLabel = `GATILLO TRASERO (${poppedCount} Hundidas)`;
    subLabel = 'Explota las burbujas y luego pulsa aquí para confirmar';
  }

  return (
    <View style={styles.footerContainer}>
      {/* Iconic ALE-HOP style rectangular logo plate from the photo */}
      <View style={styles.brandPlate}>
        <Text style={styles.brandText}>ALE-POP</Text>
      </View>

      {/* Large Tactile Back Trigger Lever Button */}
      <TouchableOpacity
        activeOpacity={0.78}
        disabled={!isPoweredOn || gameState === 'showing'}
        onPress={onPressTrigger}
        style={[
          styles.triggerButton,
          !isPoweredOn && styles.triggerDisabled,
          isReadyToConfirm && styles.triggerHighlightReady,
          isIdleOrOver && isPoweredOn && styles.triggerHighlightStart,
        ]}
      >
        <View style={styles.triggerGripLines}>
          <View style={styles.gripLine} />
          <View style={styles.gripLine} />
          <View style={styles.gripLine} />
        </View>

        <Text
          style={[
            styles.triggerMainText,
            isReadyToConfirm && styles.triggerMainTextReady,
          ]}
        >
          {mainLabel}
        </Text>
        <Text
          style={[
            styles.triggerSubText,
            isReadyToConfirm && styles.triggerSubTextReady,
          ]}
        >
          {subLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  brandPlate: {
    borderWidth: 2.5,
    borderColor: '#2b192e',
    backgroundColor: '#f7b2cc',
    paddingHorizontal: 18,
    paddingVertical: 3,
    marginBottom: 10,
    borderRadius: 3,
  },
  brandText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2b192e',
    letterSpacing: 2.2,
  },
  triggerButton: {
    width: '92%',
    backgroundColor: '#e88bb0',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 3.5,
    borderColor: '#c45b86',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#591c36',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 7,
  },
  triggerDisabled: {
    opacity: 0.55,
  },
  triggerHighlightReady: {
    backgroundColor: '#00f5d4',
    borderColor: '#00a896',
    shadowColor: '#00f5d4',
    shadowOpacity: 0.85,
    shadowRadius: 12,
    elevation: 12,
  },
  triggerHighlightStart: {
    backgroundColor: '#ffbe0b',
    borderColor: '#d49600',
    shadowColor: '#ffbe0b',
    shadowOpacity: 0.65,
    shadowRadius: 8,
  },
  triggerGripLines: {
    width: 64,
    alignItems: 'center',
    marginBottom: 5,
  },
  gripLine: {
    width: '100%',
    height: 2.5,
    backgroundColor: 'rgba(60, 20, 40, 0.25)',
    borderRadius: 2,
    marginVertical: 1,
  },
  triggerMainText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#3b1228',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  triggerMainTextReady: {
    color: '#072ac8',
    fontSize: 15,
  },
  triggerSubText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5e2342',
    marginTop: 2,
    textAlign: 'center',
  },
  triggerSubTextReady: {
    color: '#0b3954',
    fontWeight: '800',
  },
});
