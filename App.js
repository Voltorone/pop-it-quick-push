import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import ConsoleHeader, { GAME_MODES } from './src/components/ConsoleHeader';
import BubbleGrid from './src/components/BubbleGrid';
import BackTrigger from './src/components/BackTrigger';
import { soundEngine } from './src/utils/soundEngine';

const TOTAL_BUBBLES = 10;
const SUB_ROUNDS_PER_LEVEL = 5;

/**
 * Generates a fresh random sequence of bubble indices (0..9) for Memory Mode.
 * Avoids immediate duplicate consecutive bubbles so every step visibly changes.
 */
function generateRandomSequence(length) {
  const seq = [];
  let prev = -1;
  for (let i = 0; i < length; i++) {
    let next = Math.floor(Math.random() * TOTAL_BUBBLES);
    if (next === prev) {
      next = (next + 1 + Math.floor(Math.random() * (TOTAL_BUBBLES - 1))) % TOTAL_BUBBLES;
    }
    seq.push(next);
    prev = next;
  }
  return seq;
}

/**
 * Generates a fresh random set of distinct bubble indices (0..9) for Reflex / Time Attack Mode.
 */
function generateRandomBubbleSet(count) {
  const clamped = Math.max(1, Math.min(TOTAL_BUBBLES - 1, count));
  const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  return indices.slice(0, clamped);
}

export default function App() {
  // Console hardware state
  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const [modeIndex, setModeIndex] = useState(0); // 0: Memory, 1: Reflex, 2: TimeAttack
  const [volumeLevel, setVolumeLevel] = useState(3);

  // Game progress state
  const [gameState, setGameState] = useState('idle'); // 'idle' | 'showing' | 'playing' | 'awaiting_trigger' | 'gameover'
  const [level, setLevel] = useState(1);
  const [subRound, setSubRound] = useState(1);
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState({
    memory: 0,
    reflex: 0,
    timeattack: 0,
  });
  const [lives, setLives] = useState(3);
  const [statusText, setStatusText] = useState('Pulsa el gatillo inferior para jugar');

  // Bubble states (maps index 0..9 -> boolean)
  const [litBubbles, setLitBubbles] = useState({});
  const [poppedBubbles, setPoppedBubbles] = useState({});
  const [errorBubbles, setErrorBubbles] = useState({});

  // Timers & sequences
  const [timerProgress, setTimerProgress] = useState(1);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(60);

  const sequenceRef = useRef([]);
  const playerStepRef = useRef(0);
  const activeTargetsRef = useRef([]);
  const timeoutsRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const globalClockRef = useRef(null);

  const currentMode = GAME_MODES[modeIndex];

  const clearAllTimers = useCallback(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const clearGlobalClock = useCallback(() => {
    if (globalClockRef.current) {
      clearInterval(globalClockRef.current);
      globalClockRef.current = null;
    }
  }, []);

  useEffect(() => {
    soundEngine.init();
    return () => {
      clearAllTimers();
      clearGlobalClock();
    };
  }, [clearAllTimers, clearGlobalClock]);

  const updateScore = useCallback(
    (pointsToAdd) => {
      setScore((prev) => {
        const next = prev + pointsToAdd;
        setHighScores((hs) => ({
          ...hs,
          [currentMode.id]: Math.max(hs[currentMode.id] || 0, next),
        }));
        return next;
      });
    },
    [currentMode.id]
  );

  // Starts the per-round countdown bar
  const startRoundCountdown = useCallback(
    (durationMs, onTimeout) => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      const startTime = Date.now();
      setTimerProgress(1);

      timerIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 1 - elapsed / durationMs);
        setTimerProgress(remaining);
        if (remaining <= 0) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          onTimeout();
        }
      }, 35);
    },
    []
  );

  // Handles a mistake (wrong bubble or timeout)
  const handleMistake = useCallback(
    (failedIndices = [], reasonMsg = '¡Fallo! Inténtalo de nuevo') => {
      clearAllTimers();
      soundEngine.playEffect('fail');

      const errMap = {};
      failedIndices.forEach((idx) => {
        errMap[idx] = true;
      });
      setErrorBubbles(errMap);
      setLitBubbles({});

      if (currentMode.id === 'timeattack') {
        setStatusText('¡Error! Pulsa el gatillo para otra ronda');
        setGameState('awaiting_trigger');
        return;
      }

      setLives((prevLives) => {
        const nextLives = prevLives - 1;
        if (nextLives <= 0) {
          setStatusText('¡FIN DEL JUEGO! Pulsa el gatillo para reiniciar');
          setGameState('gameover');
        } else {
          setStatusText(`${reasonMsg} • Nueva secuencia en breve...`);
          const retryTimer = setTimeout(() => {
            setErrorBubbles({});
            setPoppedBubbles({});
            startRound(level, subRound, currentMode.id);
          }, 1300);
          timeoutsRef.current.push(retryTimer);
        }
        return nextLives;
      });
    },
    [clearAllTimers, currentMode.id, level, subRound]
  );

  // Launches a round with 100% freshly generated random bubbles/sequences
  const startRound = useCallback(
    (targetLevel, targetSubRound, modeId) => {
      clearAllTimers();
      setErrorBubbles({});
      setPoppedBubbles({});
      setLitBubbles({});
      playerStepRef.current = 0;

      if (modeId === 'memory') {
        // Infinite difficulty scaling for Memory Mode:
        // Sequence length starts at 2 and grows infinitely with level & subRound
        const seqLength =
          2 +
          Math.floor((targetLevel - 1) * 0.85) +
          Math.floor((targetSubRound - 1) / 2);
        // Flash speed gets faster every level (never goes below 160ms)
        const flashOnMs = Math.max(165, 520 - (targetLevel - 1) * 28);
        const flashGapMs = Math.max(85, 210 - (targetLevel - 1) * 12);

        const freshSeq = generateRandomSequence(seqLength);
        sequenceRef.current = freshSeq;

        setGameState('showing');
        setTimerProgress(1);
        setStatusText(`Observa la secuencia (${seqLength} pasos)...`);

        freshSeq.forEach((bubbleIdx, stepIdx) => {
          const onTime = 350 + stepIdx * (flashOnMs + flashGapMs);
          const offTime = onTime + flashOnMs;

          const tOn = setTimeout(() => {
            setLitBubbles({ [bubbleIdx]: true });
            soundEngine.playBubbleLight(bubbleIdx);
          }, onTime);

          const tOff = setTimeout(() => {
            setLitBubbles({});
          }, offTime);

          timeoutsRef.current.push(tOn, tOff);
        });

        const totalShowTime =
          380 + freshSeq.length * (flashOnMs + flashGapMs);
        const tPlay = setTimeout(() => {
          setGameState('playing');
          setStatusText(`¡Tu turno! Repite los ${seqLength} pasos en orden`);
          // Give player a fair but scaling time window to repeat + push trigger
          const allowedTimeMs = Math.max(
            2600,
            seqLength * Math.max(680, 1350 - (targetLevel - 1) * 55) + 1500
          );
          startRoundCountdown(allowedTimeMs, () => {
            const expectedIdx =
              sequenceRef.current[playerStepRef.current] ?? 0;
            handleMistake([expectedIdx], '¡Tiempo agotado!');
          });
        }, totalShowTime);

        timeoutsRef.current.push(tPlay);
      } else if (modeId === 'reflex') {
        // Infinite difficulty scaling for Reflex (Quick Push) Mode:
        // Number of simultaneous bubbles increases from 1-2 up to 7
        const minBubbles = Math.min(5, 1 + Math.floor((targetLevel - 1) / 2));
        const maxBubbles = Math.min(
          8,
          2 + Math.floor(targetLevel * 0.75) + Math.floor(targetSubRound / 2)
        );
        const count =
          minBubbles +
          Math.floor(Math.random() * Math.max(1, maxBubbles - minBubbles + 1));

        // Time window shrinks asymptotically with level so it scales infinitely
        const timeLimitMs = Math.max(
          950,
          Math.floor(
            4300 * Math.pow(0.9, targetLevel - 1) - (targetSubRound - 1) * 85
          )
        );

        const targets = generateRandomBubbleSet(count);
        activeTargetsRef.current = targets;

        const litMap = {};
        targets.forEach((idx) => {
          litMap[idx] = true;
        });

        setLitBubbles(litMap);
        setGameState('playing');
        setStatusText(`¡Explota las ${count} burbujas y pulsa el gatillo!`);
        soundEngine.playBubbleLight(targets[0]);

        startRoundCountdown(timeLimitMs, () => {
          handleMistake(activeTargetsRef.current, '¡Demasiado lento!');
        });
      } else if (modeId === 'timeattack') {
        // Time Attack 60s Mode
        const count = Math.min(
          7,
          2 + Math.floor(Math.random() * (2 + Math.floor(targetLevel / 2)))
        );
        const targets = generateRandomBubbleSet(count);
        activeTargetsRef.current = targets;

        const litMap = {};
        targets.forEach((idx) => {
          litMap[idx] = true;
        });

        setLitBubbles(litMap);
        setGameState('playing');
        setStatusText(`¡Rápido! Explota las ${count} burbujas + Gatillo`);
        soundEngine.playBubbleLight(targets[0]);
      }
    },
    [clearAllTimers, handleMistake, startRoundCountdown]
  );

  // Handles pressing one of the 10 silicone bubbles
  const handlePressBubble = (bubbleIdx) => {
    if (!isPoweredOn) return;

    // In Idle state, let user freely pop bubbles like a fidget toy!
    if (gameState === 'idle') {
      soundEngine.playBubblePop(bubbleIdx);
      setPoppedBubbles((prev) => ({
        ...prev,
        [bubbleIdx]: !prev[bubbleIdx],
      }));
      setLitBubbles({ [bubbleIdx]: true });
      setTimeout(() => {
        setLitBubbles((prev) => {
          const next = { ...prev };
          delete next[bubbleIdx];
          return next;
        });
      }, 180);
      return;
    }

    if (gameState !== 'playing') return;

    if (currentMode.id === 'memory') {
      const expectedBubble = sequenceRef.current[playerStepRef.current];
      if (bubbleIdx === expectedBubble) {
        soundEngine.playBubblePop(bubbleIdx);
        setPoppedBubbles((prev) => ({ ...prev, [bubbleIdx]: true }));
        setLitBubbles({ [bubbleIdx]: true });

        const nextStep = playerStepRef.current + 1;
        playerStepRef.current = nextStep;

        // If the next bubble in the sequence is already popped earlier, we still allow re-pressing it,
        // and we briefly unpop it so the tactile visual feedback is clear
        if (nextStep < sequenceRef.current.length) {
          const upcomingIdx = sequenceRef.current[nextStep];
          setTimeout(() => {
            setLitBubbles({});
            setPoppedBubbles((prev) => {
              if (!prev[upcomingIdx]) return prev;
              const copy = { ...prev };
              delete copy[upcomingIdx];
              return copy;
            });
          }, 140);
          setStatusText(
            `¡Bien! Paso ${nextStep}/${sequenceRef.current.length} • Sigue...`
          );
        } else {
          // Sequence completed! Now player must push the Back Trigger
          setTimeout(() => setLitBubbles({}), 160);
          setGameState('awaiting_trigger');
          setStatusText('¡Secuencia completa! ¡PULSA EL GATILLO TRASERO! ⏫');
        }
      } else {
        handleMistake([bubbleIdx, expectedBubble], '¡Burbuja equivocada!');
      }
    } else {
      // Reflex or Time Attack mode
      const isTarget = activeTargetsRef.current.includes(bubbleIdx);
      if (!isTarget) {
        handleMistake([bubbleIdx], '¡Esa burbuja no estaba iluminada!');
        return;
      }

      soundEngine.playBubblePop(bubbleIdx);
      const remainingTargets = activeTargetsRef.current.filter(
        (id) => id !== bubbleIdx
      );
      activeTargetsRef.current = remainingTargets;

      setPoppedBubbles((prev) => ({ ...prev, [bubbleIdx]: true }));
      setLitBubbles((prev) => {
        const copy = { ...prev };
        delete copy[bubbleIdx];
        return copy;
      });

      if (remainingTargets.length === 0) {
        setGameState('awaiting_trigger');
        setStatusText('¡Todas explotadas! ¡PULSA EL GATILLO TRASERO! ⏫');
      }
    }
  };

  // Handles pressing the large Back Trigger lever at the bottom
  const handlePressBackTrigger = () => {
    if (!isPoweredOn) return;

    // Start new game if idle or gameover
    if (gameState === 'idle' || gameState === 'gameover') {
      soundEngine.playEffect('triggerReset');
      clearAllTimers();
      clearGlobalClock();
      setScore(0);
      setLives(3);
      setLevel(1);
      setSubRound(1);
      setPoppedBubbles({});
      setErrorBubbles({});
      setLitBubbles({});

      if (currentMode.id === 'timeattack') {
        setTimeLeftSeconds(60);
        setTimerProgress(1);
        const startTs = Date.now();
        globalClockRef.current = setInterval(() => {
          const elapsedSec = (Date.now() - startTs) / 1000;
          const rem = Math.max(0, 60 - elapsedSec);
          setTimeLeftSeconds(Math.ceil(rem));
          setTimerProgress(rem / 60);
          if (rem <= 0) {
            clearGlobalClock();
            clearAllTimers();
            soundEngine.playEffect('roundSuccess');
            setLitBubbles({});
            setGameState('gameover');
            setStatusText('¡TIEMPO TERMINADO! Pulsa el gatillo para otra');
          }
        }, 100);
      }

      startRound(1, 1, currentMode.id);
      return;
    }

    // Confirm completed round and push all bubbles back up!
    if (gameState === 'awaiting_trigger') {
      clearAllTimers();
      soundEngine.playEffect('triggerReset');
      setPoppedBubbles({});
      setErrorBubbles({});
      setLitBubbles({});

      if (currentMode.id === 'timeattack') {
        updateScore(15 + level * 5);
        const nextSub = subRound + 1;
        const nextLvl = nextSub > SUB_ROUNDS_PER_LEVEL ? level + 1 : level;
        const wrappedSub = nextSub > SUB_ROUNDS_PER_LEVEL ? 1 : nextSub;
        setLevel(nextLvl);
        setSubRound(wrappedSub);
        startRound(nextLvl, wrappedSub, 'timeattack');
        return;
      }

      // Memory or Reflex mode advancement
      const bonusPoints = level * 10 + Math.round(timerProgress * 15);
      updateScore(bonusPoints);

      if (subRound < SUB_ROUNDS_PER_LEVEL) {
        const nextSub = subRound + 1;
        setSubRound(nextSub);
        setStatusText(`¡Ronda ${subRound}/${SUB_ROUNDS_PER_LEVEL} superada!`);
        const tNext = setTimeout(() => {
          startRound(level, nextSub, currentMode.id);
        }, 420);
        timeoutsRef.current.push(tNext);
      } else {
        // Level Up!
        const nextLevel = level + 1;
        soundEngine.playEffect('roundSuccess');
        setLevel(nextLevel);
        setSubRound(1);
        setStatusText(`🎉 ¡NIVEL ${nextLevel} DESBLOQUEADO! Más rápido...`);
        // Celebratory LED wave
        const allLit = {};
        for (let i = 0; i < TOTAL_BUBBLES; i++) allLit[i] = true;
        setLitBubbles(allLit);

        const tNextLvl = setTimeout(() => {
          setLitBubbles({});
          startRound(nextLevel, 1, currentMode.id);
        }, 950);
        timeoutsRef.current.push(tNextLvl);
      }
      return;
    }

    // If pressed prematurely during 'playing' before popping all required bubbles
    if (gameState === 'playing') {
      handleMistake(
        activeTargetsRef.current,
        '¡Pulsaste el gatillo antes de terminar!'
      );
    }
  };

  // Top Button: Power ON/OFF
  const handleTogglePower = () => {
    clearAllTimers();
    clearGlobalClock();
    if (isPoweredOn) {
      soundEngine.playEffect('powerOff');
      setIsPoweredOn(false);
      setGameState('idle');
      setLitBubbles({});
      setPoppedBubbles({});
      setErrorBubbles({});
    } else {
      soundEngine.playEffect('powerOn');
      setIsPoweredOn(true);
      setGameState('idle');
      setStatusText('Modo Libre o pulsa el Gatillo para jugar');
    }
  };

  // Top Button: Cycle Game Mode
  const handleCycleMode = () => {
    if (!isPoweredOn) return;
    clearAllTimers();
    clearGlobalClock();
    soundEngine.playEffect('modeSwitch');
    const nextIdx = (modeIndex + 1) % GAME_MODES.length;
    setModeIndex(nextIdx);
    setGameState('idle');
    setLevel(1);
    setSubRound(1);
    setScore(0);
    setLives(3);
    setTimerProgress(1);
    setTimeLeftSeconds(60);
    setLitBubbles({});
    setPoppedBubbles({});
    setErrorBubbles({});
    setStatusText(GAME_MODES[nextIdx].subtitle);
  };

  // Top Button: Cycle Volume
  const handleCycleVolume = () => {
    if (!isPoweredOn) return;
    const nextVol = soundEngine.cycleVolume();
    setVolumeLevel(nextVol);
  };

  const poppedCount = Object.values(poppedBubbles).filter(Boolean).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#23192d" />
      <View style={styles.screenBackground}>
        {/* Main Pink ALE-HOP Ergonomic Console Shell */}
        <View style={styles.consoleBody}>
          {/* Decorative Left & Right Ergonomic Grip Grooves (from the photo) */}
          <View style={styles.leftGripArc} pointerEvents="none" />
          <View style={styles.rightGripArc} pointerEvents="none" />

          {/* Top 3 Buttons + Digital LED Status Screen */}
          <ConsoleHeader
            isPoweredOn={isPoweredOn}
            modeIndex={modeIndex}
            volumeLevel={volumeLevel}
            onTogglePower={handleTogglePower}
            onCycleMode={handleCycleMode}
            onCycleVolume={handleCycleVolume}
            level={level}
            subRound={subRound}
            totalSubRounds={SUB_ROUNDS_PER_LEVEL}
            score={score}
            highScore={highScores[currentMode.id] || 0}
            lives={lives}
            statusText={statusText}
            timerProgress={timerProgress}
            timeLeftSeconds={timeLeftSeconds}
          />

          {/* Central Orange Silicone 3-4-3 Pop-It Matrix */}
          <BubbleGrid
            litBubbles={litBubbles}
            poppedBubbles={poppedBubbles}
            errorBubbles={errorBubbles}
            onPressBubble={handlePressBubble}
            disabled={gameState === 'showing'}
            isPoweredOn={isPoweredOn}
            accentLedColor={currentMode.ledColor}
          />

          {/* Bottom Brand Plate & Tactile Back Trigger Lever */}
          <BackTrigger
            isPoweredOn={isPoweredOn}
            gameState={gameState}
            onPressTrigger={handlePressBackTrigger}
            poppedCount={poppedCount}
          />
        </View>

        {/* Bottom Helper Legend */}
        <Text style={styles.helperCaption}>
          {isPoweredOn
            ? `💡 ${currentMode.name}: ${currentMode.subtitle}`
            : 'Pulsa el botón central ⏻ para encender la consola'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const CONSOLE_MAX_WIDTH = Math.min(width - 20, 420);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#23192d',
  },
  screenBackground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  consoleBody: {
    width: CONSOLE_MAX_WIDTH,
    backgroundColor: '#f5a3c7',
    borderRadius: 64,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 5,
    borderColor: '#e07aa8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  leftGripArc: {
    position: 'absolute',
    left: -26,
    top: '28%',
    width: 48,
    height: '46%',
    borderRadius: 30,
    borderWidth: 3.5,
    borderColor: '#df7ca8',
    opacity: 0.7,
  },
  rightGripArc: {
    position: 'absolute',
    right: -26,
    top: '28%',
    width: 48,
    height: '46%',
    borderRadius: 30,
    borderWidth: 3.5,
    borderColor: '#df7ca8',
    opacity: 0.7,
  },
  helperCaption: {
    marginTop: 12,
    color: '#d8c5e8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 18,
  },
});
