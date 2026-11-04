import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  StyleSheet,
} from 'react-native';
import { GAME_MODES } from './ConsoleHeader';

// Free Fire / Mobile Shooter ergonomic right-thumb arc offsets for the 4 spheres
const ACTION_BUTTON_LAYOUT = [
  { id: 0, icon: '⊕', isPrimary: true, bottom: 26, right: 92 },   // Primary Fire
  { id: 1, icon: '⌖', isPrimary: false, bottom: 118, right: 108 }, // Scope / Aim
  { id: 2, icon: '⚡', isPrimary: false, bottom: 112, right: 24 },  // Jump / Dash
  { id: 3, icon: '◈', isPrimary: false, bottom: 28, right: 16 },   // Crouch / Shield
];

export default function GamingLandscapeView({
  isPoweredOn,
  modeIndex,
  volumeLevel,
  onTogglePower,
  onCycleMode,
  onCycleVolume,
  level,
  subRound,
  score,
  highScore,
  lives,
  gameState,
  timerProgress,
  timeLeftSeconds,
  targetStickAngle, // null or 0..359 deg (0 = Right/East, 90 = Up/North, etc. or screen compass)
  stickCompleted,
  litActionButtons,
  poppedActionButtons,
  errorActionButtons,
  stickError,
  lastPrecisionPct,
  onStickDirectionInput,
  onPressActionButton,
  onPressTrigger,
}) {
  const currentMode = GAME_MODES[modeIndex];
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const stickReleasedRef = useRef(true);
  const MAX_RADIUS = 56;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        stickReleasedRef.current = false;
        setKnobPos({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clampedDist = Math.min(MAX_RADIUS, dist);
        const rad = Math.atan2(dy, dx);
        setKnobPos({
          x: Math.cos(rad) * clampedDist,
          y: Math.sin(rad) * clampedDist,
        });

        // Trigger directional input once pushed past 72% of radius
        if (!stickReleasedRef.current && dist >= MAX_RADIUS * 0.72) {
          stickReleasedRef.current = true;
          // Convert (dx, dy) to compass angle: 0° = Up, 90° = Right, 180° = Down, 270° = Left
          let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
          if (deg < 0) deg += 360;
          onStickDirectionInput(deg);
        }
      },
      onPanResponderRelease: () => {
        stickReleasedRef.current = true;
        setKnobPos({ x: 0, y: 0 });
      },
      onPanResponderTerminate: () => {
        stickReleasedRef.current = true;
        setKnobPos({ x: 0, y: 0 });
      },
    })
  ).current;

  return (
    <View style={styles.landscapeContainer}>
      {/* LEFT ZONE: Virtual Analog Joystick with Directional Vector */}
      <View style={styles.leftZone}>
        <View
          style={[
            styles.joystickOuterRing,
            targetStickAngle !== null &&
              !stickCompleted && {
                borderColor: currentMode.ledColor,
                shadowColor: currentMode.ledColor,
                shadowOpacity: 0.75,
                shadowRadius: 14,
              },
            stickError && styles.joystickErrorRing,
          ]}
          {...panResponder.panHandlers}
        >
          {/* Crosshair Axis Lines */}
          <View style={styles.axisHorizontal} />
          <View style={styles.axisVertical} />

          {/* Target Direction Arrow Vector */}
          {targetStickAngle !== null && !stickCompleted && (
            <View
              style={[
                styles.vectorArrowWrapper,
                { transform: [{ rotate: `${targetStickAngle}deg` }] },
              ]}
            >
              <View
                style={[
                  styles.vectorBeam,
                  { backgroundColor: currentMode.ledColor },
                ]}
              />
              <Text
                style={[
                  styles.vectorArrowHead,
                  { color: currentMode.ledColor },
                ]}
              >
                ▲
              </Text>
            </View>
          )}

          {/* Draggable Analog Thumbstick Knob */}
          <View
            style={[
              styles.joystickKnob,
              {
                transform: [
                  { translateX: knobPos.x },
                  { translateY: knobPos.y },
                ],
              },
              stickCompleted && {
                borderColor: '#00f59b',
                backgroundColor: '#132a26',
              },
            ]}
          >
            <View
              style={[
                styles.knobCore,
                targetStickAngle !== null &&
                  !stickCompleted && {
                    borderColor: currentMode.ledColor,
                  },
              ]}
            />
          </View>
        </View>
      </View>

      {/* CENTER ZONE: Tactical Pro-Trainer Telemetry HUD & Reload Trigger */}
      <View style={styles.centerZone}>
        {/* Top Hardware Controls */}
        <View style={styles.topControlsRow}>
          <TouchableOpacity
            style={[
              styles.smallBtn,
              isPoweredOn && { borderColor: currentMode.ledColor },
            ]}
            onPress={onCycleMode}
          >
            <Text style={[styles.smallBtnText, { color: currentMode.ledColor }]}>
              {currentMode.icon}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallBtn, isPoweredOn && styles.powerBtnActive]}
            onPress={onTogglePower}
          >
            <Text style={styles.smallBtnText}>⏻</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.smallBtn} onPress={onCycleVolume}>
            <Text style={styles.smallBtnText}>
              {volumeLevel === 0 ? '🔇' : '🔊'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tactical Telemetry Panel */}
        <View style={styles.telemetryBox}>
          <View style={styles.telemetryHeader}>
            <Text style={styles.levelBadge}>
              {currentMode.id === 'timeattack'
                ? `${String(timeLeftSeconds).padStart(2, '0')}s`
                : `LV ${String(level).padStart(2, '0')}•${subRound}`}
            </Text>

            <Text
              style={[
                styles.precisionBadge,
                {
                  color:
                    lastPrecisionPct >= 90
                      ? '#00f59b'
                      : lastPrecisionPct >= 75
                      ? '#00f0ff'
                      : '#ffb800',
                },
              ]}
            >
              ⌖ {lastPrecisionPct}%
            </Text>

            <View style={styles.livesCluster}>
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
          </View>

          <View style={styles.scoreRow}>
            <Text style={styles.scoreDigits}>{score}</Text>
            <Text style={styles.bestDigits}>★ {highScore}</Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(0, Math.min(100, timerProgress * 100))}%`,
                  backgroundColor:
                    timerProgress < 0.25 ? '#ff2a6d' : currentMode.ledColor,
                },
              ]}
            />
          </View>
        </View>

        {/* Center Tactical Reload / Confirm Trigger */}
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={!isPoweredOn || gameState === 'showing'}
          onPress={onPressTrigger}
          style={[
            styles.tacticalTrigger,
            (gameState === 'awaiting_trigger' ||
              gameState === 'idle' ||
              gameState === 'gameover') &&
              isPoweredOn && {
                borderColor: currentMode.ledColor,
                backgroundColor: '#172230',
              },
          ]}
        >
          <Text
            style={[
              styles.tacticalTriggerIcon,
              { color: currentMode.ledColor },
            ]}
          >
            {gameState === 'idle'
              ? '▶'
              : gameState === 'gameover'
              ? '↺'
              : '⏫'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* RIGHT ZONE: 4 Shooter Action Spheres in Claw/Thumb Arc */}
      <View style={styles.rightZone}>
        <View style={styles.shooterCluster}>
          {ACTION_BUTTON_LAYOUT.map((btn) => {
            const isLit = Boolean(litActionButtons[btn.id]);
            const isPopped = Boolean(poppedActionButtons[btn.id]);
            const isErr = Boolean(errorActionButtons[btn.id]);
            const size = btn.isPrimary ? 76 : 58;

            return (
              <TouchableOpacity
                key={btn.id}
                activeOpacity={0.82}
                disabled={!isPoweredOn || gameState === 'showing'}
                onPress={() => onPressActionButton(btn.id)}
                style={[
                  styles.actionSphere,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    bottom: btn.bottom,
                    right: btn.right,
                  },
                  isPopped && styles.actionSpherePopped,
                  isLit && {
                    borderColor: currentMode.ledColor,
                    backgroundColor: '#1e2c3d',
                    shadowColor: currentMode.ledColor,
                    shadowOpacity: 0.95,
                    shadowRadius: 14,
                  },
                  isErr && styles.actionSphereError,
                ]}
              >
                <Text
                  style={[
                    styles.actionIcon,
                    btn.isPrimary && styles.actionIconPrimary,
                    isLit && { color: currentMode.ledColor },
                  ]}
                >
                  {btn.icon}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  landscapeContainer: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#090c10',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  leftZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joystickOuterRing: {
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: '#11161f',
    borderWidth: 2,
    borderColor: '#263042',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  joystickErrorRing: {
    borderColor: '#ff2a6d',
    backgroundColor: '#2a121b',
  },
  axisHorizontal: {
    position: 'absolute',
    width: '86%',
    height: 1,
    backgroundColor: '#1d2536',
  },
  axisVertical: {
    position: 'absolute',
    height: '86%',
    width: 1,
    backgroundColor: '#1d2536',
  },
  vectorArrowWrapper: {
    position: 'absolute',
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  vectorBeam: {
    position: 'absolute',
    top: 16,
    width: 4,
    height: 56,
    borderRadius: 2,
    opacity: 0.85,
  },
  vectorArrowHead: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  joystickKnob: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1f2637',
    borderWidth: 2,
    borderColor: '#3d4a66',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  knobCore: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#526080',
  },
  centerZone: {
    width: 210,
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '92%',
  },
  topControlsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  smallBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#171c28',
    borderWidth: 1.5,
    borderColor: '#2d3548',
    alignItems: 'center',
    justifyContent: 'center',
  },
  powerBtnActive: {
    borderColor: '#00f59b',
  },
  smallBtnText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  telemetryBox: {
    width: '100%',
    backgroundColor: '#0f131c',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#222a3a',
  },
  telemetryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  levelBadge: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  precisionBadge: {
    fontSize: 12,
    fontWeight: '800',
  },
  livesCluster: {
    flexDirection: 'row',
    gap: 4,
  },
  lifeDiamond: {
    width: 6,
    height: 6,
    borderRadius: 1.5,
    transform: [{ rotate: '45deg' }],
    backgroundColor: '#232836',
  },
  lifeDiamondActive: {
    backgroundColor: '#ff2a6d',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  scoreDigits: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
  },
  bestDigits: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#1c2230',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  tacticalTrigger: {
    width: '92%',
    height: 46,
    borderRadius: 23,
    backgroundColor: '#181e2b',
    borderWidth: 1.5,
    borderColor: '#2f384d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tacticalTriggerIcon: {
    fontSize: 18,
    fontWeight: '900',
  },
  rightZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shooterCluster: {
    width: 200,
    height: 196,
    position: 'relative',
  },
  actionSphere: {
    position: 'absolute',
    backgroundColor: '#1c2230',
    borderWidth: 2,
    borderColor: '#343e56',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  actionSpherePopped: {
    backgroundColor: '#11151e',
    borderColor: '#1e2433',
    transform: [{ scale: 0.9 }],
  },
  actionSphereError: {
    borderColor: '#ff2a6d',
    backgroundColor: '#331420',
  },
  actionIcon: {
    color: '#64748b',
    fontSize: 20,
    fontWeight: '800',
  },
  actionIconPrimary: {
    fontSize: 26,
  },
});
