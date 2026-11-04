import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import ConsoleHeader, { GAME_MODES } from './src/components/ConsoleHeader';
import BubbleGrid from './src/components/BubbleGrid';
import BackTrigger from './src/components/BackTrigger';
import GamingLandscapeView from './src/components/GamingLandscapeView';
import { soundEngine } from './src/utils/soundEngine';
import { proceduralDirector } from './src/utils/proceduralEngine';

const TOTAL_BUBBLES = 10;
const SUB_ROUNDS_PER_LEVEL = 5;

function shortestAngleDiff(a, b) {
  let diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export default function App() {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const isLandscape = dimensions.width > dimensions.height;

  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const [modeIndex, setModeIndex] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(3);

  const [gameState, setGameState] = useState('idle');
  const [level, setLevel] = useState(1);
  const [subRound, setSubRound] = useState(1);
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState({
    memory: 0,
    reflex: 0,
    timeattack: 0,
  });
  const [lives, setLives] = useState(3);

  // Portrait 10-bubble states
  const [litBubbles, setLitBubbles] = useState({});
  const [poppedBubbles, setPoppedBubbles] = useState({});
  const [errorBubbles, setErrorBubbles] = useState({});

  // Landscape Gaming Mode states (Left Joystick + Right 4 Shooter Spheres)
  const [targetStickAngle, setTargetStickAngle] = useState(null);
  const [stickCompleted, setStickCompleted] = useState(false);
  const [stickError, setStickError] = useState(false);
  const [lastPrecisionPct, setLastPrecisionPct] = useState(100);

  const [timerProgress, setTimerProgress] = useState(1);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(60);

  const sequenceRef = useRef([]);
  const gamingStepsRef = useRef([]);
  const playerStepRef = useRef(0);
  const pendingWavesRef = useRef([]);
  const activeTargetsRef = useRef([]);
  const angleToleranceRef = useRef(24);
  const timeoutsRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const globalClockRef = useRef(null);

  const roundPlayStartTsRef = useRef(0);
  const roundTapCountRef = useRef(0);

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
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => {
      if (sub && sub.remove) sub.remove();
      clearAllTimers();
      clearGlobalClock();
    };
  }, [clearAllTimers, clearGlobalClock]);

  // Reset active round cleanly when user rotates between Portrait and Landscape
  useEffect(() => {
    clearAllTimers();
    clearGlobalClock();
    setGameState('idle');
    setLitBubbles({});
    setPoppedBubbles({});
    setErrorBubbles({});
    setTargetStickAngle(null);
    setStickCompleted(false);
    setStickError(false);
    setTimerProgress(1);
  }, [isLandscape, clearAllTimers, clearGlobalClock]);

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

  const startRoundCountdown = useCallback((durationMs, onTimeout) => {
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
  }, []);

  const handleMistake = useCallback(
    (failedIndices = [], isStickFail = false) => {
      clearAllTimers();
      soundEngine.playEffect('fail');

      proceduralDirector.recordRoundPerformance({
        success: false,
        remainingTimeRatio: 0,
        avgMsPerTap: 900,
      });

      const errMap = {};
      failedIndices.forEach((idx) => {
        errMap[idx] = true;
      });
      setErrorBubbles(errMap);
      setStickError(isStickFail);
      setLitBubbles({});

      if (currentMode.id === 'timeattack') {
        setGameState('awaiting_trigger');
        return;
      }

      setLives((prevLives) => {
        const nextLives = prevLives - 1;
        if (nextLives <= 0) {
          setGameState('gameover');
        } else {
          const retryTimer = setTimeout(() => {
            setErrorBubbles({});
            setPoppedBubbles({});
            setStickError(false);
            startRound(level, subRound, currentMode.id);
          }, 1100);
          timeoutsRef.current.push(retryTimer);
        }
        return nextLives;
      });
    },
    [clearAllTimers, currentMode.id, level, subRound]
  );

  const startRound = useCallback(
    (targetLevel, targetSubRound, modeId) => {
      clearAllTimers();
      setErrorBubbles({});
      setPoppedBubbles({});
      setLitBubbles({});
      setTargetStickAngle(null);
      setStickCompleted(false);
      setStickError(false);
      playerStepRef.current = 0;
      roundTapCountRef.current = 0;

      if (isLandscape) {
        // HORIZONTAL GAMING MODE (Left Joystick + Right 4 Shooter Spheres)
        const gParams = proceduralDirector.generateGamingRoundParams(
          targetLevel,
          targetSubRound,
          modeId
        );
        angleToleranceRef.current = gParams.angleToleranceDeg;

        if (modeId === 'memory') {
          const { steps, flashOnMs, flashGapMs, allowedTimeMs } = gParams;
          gamingStepsRef.current = steps;
          setGameState('showing');
          setTimerProgress(1);

          let cursorMs = 340;
          steps.forEach((step) => {
            const onTime = cursorMs;
            const offTime = onTime + flashOnMs;
            cursorMs = offTime + flashGapMs;

            const tOn = setTimeout(() => {
              if (step.type === 'stick') {
                setTargetStickAngle(step.angle);
                setLitBubbles({});
                soundEngine.playBubbleLight(Math.floor(step.angle / 45) % 10);
              } else {
                setTargetStickAngle(null);
                setLitBubbles({ [step.index]: true });
                soundEngine.playBubbleLight(step.index);
              }
            }, onTime);

            const tOff = setTimeout(() => {
              setTargetStickAngle(null);
              setLitBubbles({});
            }, offTime);

            timeoutsRef.current.push(tOn, tOff);
          });

          const tPlay = setTimeout(() => {
            roundPlayStartTsRef.current = Date.now();
            setGameState('playing');
            const firstStep = steps[0];
            if (firstStep.type === 'stick') {
              setTargetStickAngle(firstStep.angle);
            }
            startRoundCountdown(allowedTimeMs, () => {
              handleMistake([], true);
            });
          }, cursorMs + 40);

          timeoutsRef.current.push(tPlay);
        } else {
          // Reflex or Time Attack in Gaming Mode
          const [firstWave, ...restWaves] = gParams.waves;
          pendingWavesRef.current = restWaves;
          activeTargetsRef.current = firstWave.buttons;
          setTargetStickAngle(firstWave.stickAngle);
          setStickCompleted(false);

          const litMap = {};
          firstWave.buttons.forEach((id) => {
            litMap[id] = true;
          });
          setLitBubbles(litMap);
          roundPlayStartTsRef.current = Date.now();
          setGameState('playing');
          soundEngine.playBubbleLight(firstWave.buttons[0] ?? 0);

          if (modeId === 'reflex') {
            startRoundCountdown(gParams.timeLimitMs, () => {
              handleMistake(activeTargetsRef.current, !stickCompleted);
            });
          }
        }
        return;
      }

      // PORTRAIT CONSOLE MODE (10-bubble 3-4-3 pad)
      const params = proceduralDirector.generateRoundParams(
        targetLevel,
        targetSubRound,
        modeId
      );

      if (modeId === 'memory') {
        const { sequence, stepTimings, allowedTimeMs } = params;
        sequenceRef.current = sequence;

        setGameState('showing');
        setTimerProgress(1);

        let cursorMs = 340;
        sequence.forEach((bubbleIdx, stepIdx) => {
          const { onMs, gapMs } = stepTimings[stepIdx];
          const onTime = cursorMs;
          const offTime = onTime + onMs;
          cursorMs = offTime + gapMs;

          const tOn = setTimeout(() => {
            setLitBubbles({ [bubbleIdx]: true });
            soundEngine.playBubbleLight(bubbleIdx);
          }, onTime);

          const tOff = setTimeout(() => {
            setLitBubbles({});
          }, offTime);

          timeoutsRef.current.push(tOn, tOff);
        });

        const tPlay = setTimeout(() => {
          roundPlayStartTsRef.current = Date.now();
          setGameState('playing');
          startRoundCountdown(allowedTimeMs, () => {
            const expectedIdx = sequenceRef.current[playerStepRef.current] ?? 0;
            handleMistake([expectedIdx]);
          });
        }, cursorMs + 40);

        timeoutsRef.current.push(tPlay);
      } else if (modeId === 'reflex') {
        const { waves, timeLimitMs } = params;
        const [firstWave, ...restWaves] = waves;
        pendingWavesRef.current = restWaves;
        activeTargetsRef.current = firstWave;

        const litMap = {};
        firstWave.forEach((idx) => {
          litMap[idx] = true;
        });

        roundPlayStartTsRef.current = Date.now();
        setLitBubbles(litMap);
        setGameState('playing');
        soundEngine.playBubbleLight(firstWave[0]);

        startRoundCountdown(timeLimitMs, () => {
          handleMistake(activeTargetsRef.current);
        });
      } else if (modeId === 'timeattack') {
        const [firstWave] = params.waves;
        pendingWavesRef.current = [];
        activeTargetsRef.current = firstWave;

        const litMap = {};
        firstWave.forEach((idx) => {
          litMap[idx] = true;
        });

        roundPlayStartTsRef.current = Date.now();
        setLitBubbles(litMap);
        setGameState('playing');
        soundEngine.playBubbleLight(firstWave[0]);
      }
    },
    [clearAllTimers, handleMistake, isLandscape, startRoundCountdown, stickCompleted]
  );

  // Handles Left-Hand Analog Joystick direction input in Landscape Gaming Mode
  const handleStickDirectionInput = (inputAngleDeg) => {
    if (!isPoweredOn || gameState !== 'playing') return;

    roundTapCountRef.current += 1;

    if (currentMode.id === 'memory') {
      const currentStep = gamingStepsRef.current[playerStepRef.current];
      if (!currentStep || currentStep.type !== 'stick') {
        handleMistake([], true);
        return;
      }
      const errDeg = shortestAngleDiff(inputAngleDeg, currentStep.angle);
      if (errDeg > angleToleranceRef.current) {
        handleMistake([], true);
        return;
      }

      const precision = Math.max(50, Math.round(100 - (errDeg / angleToleranceRef.current) * 35));
      setLastPrecisionPct(precision);
      if (precision >= 92) updateScore(10);

      soundEngine.playBubblePop(Math.floor(currentStep.angle / 45) % 10);
      const nextIdx = playerStepRef.current + 1;
      playerStepRef.current = nextIdx;

      if (nextIdx < gamingStepsRef.current.length) {
        const nextStep = gamingStepsRef.current[nextIdx];
        setTargetStickAngle(nextStep.type === 'stick' ? nextStep.angle : null);
      } else {
        setTargetStickAngle(null);
        setStickCompleted(true);
        setGameState('awaiting_trigger');
      }
      return;
    }

    // Reflex / Time Attack mode in Landscape
    if (targetStickAngle === null || stickCompleted) return;
    const errDeg = shortestAngleDiff(inputAngleDeg, targetStickAngle);
    if (errDeg > angleToleranceRef.current) {
      handleMistake([], true);
      return;
    }

    const precision = Math.max(50, Math.round(100 - (errDeg / angleToleranceRef.current) * 35));
    setLastPrecisionPct(precision);
    if (precision >= 92) updateScore(12);

    soundEngine.playBubblePop(0);
    setStickCompleted(true);

    if (activeTargetsRef.current.length === 0) {
      if (pendingWavesRef.current.length > 0) {
        const [nextWave, ...rest] = pendingWavesRef.current;
        pendingWavesRef.current = rest;
        activeTargetsRef.current = nextWave.buttons;
        setTargetStickAngle(nextWave.stickAngle);
        setStickCompleted(false);
        setPoppedBubbles({});
        const nextLit = {};
        nextWave.buttons.forEach((id) => {
          nextLit[id] = true;
        });
        setLitBubbles(nextLit);
      } else {
        setGameState('awaiting_trigger');
      }
    }
  };

  const handlePressBubble = (bubbleIdx) => {
    if (!isPoweredOn) return;

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

    roundTapCountRef.current += 1;

    if (isLandscape && currentMode.id === 'memory') {
      const currentStep = gamingStepsRef.current[playerStepRef.current];
      if (!currentStep || currentStep.type !== 'btn' || currentStep.index !== bubbleIdx) {
        handleMistake([bubbleIdx], false);
        return;
      }
      soundEngine.playBubblePop(bubbleIdx);
      setPoppedBubbles((prev) => ({ ...prev, [bubbleIdx]: true }));
      const nextIdx = playerStepRef.current + 1;
      playerStepRef.current = nextIdx;

      if (nextIdx < gamingStepsRef.current.length) {
        const nextStep = gamingStepsRef.current[nextIdx];
        setTargetStickAngle(nextStep.type === 'stick' ? nextStep.angle : null);
        if (nextStep.type === 'btn') {
          setTimeout(() => {
            setPoppedBubbles((prev) => {
              const copy = { ...prev };
              delete copy[nextStep.index];
              return copy;
            });
          }, 120);
        }
      } else {
        setTargetStickAngle(null);
        setGameState('awaiting_trigger');
      }
      return;
    }

    if (currentMode.id === 'memory') {
      const expectedBubble = sequenceRef.current[playerStepRef.current];
      if (bubbleIdx === expectedBubble) {
        soundEngine.playBubblePop(bubbleIdx);
        setPoppedBubbles((prev) => ({ ...prev, [bubbleIdx]: true }));
        setLitBubbles({ [bubbleIdx]: true });

        const nextStep = playerStepRef.current + 1;
        playerStepRef.current = nextStep;

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
          }, 130);
        } else {
          setTimeout(() => setLitBubbles({}), 150);
          setGameState('awaiting_trigger');
        }
      } else {
        handleMistake([bubbleIdx, expectedBubble]);
      }
    } else {
      const isTarget = activeTargetsRef.current.includes(bubbleIdx);
      if (!isTarget) {
        handleMistake([bubbleIdx]);
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

      const allDoneForWave =
        remainingTargets.length === 0 && (!isLandscape || stickCompleted);

      if (allDoneForWave) {
        if (pendingWavesRef.current.length > 0) {
          const [nextWave, ...rest] = pendingWavesRef.current;
          pendingWavesRef.current = rest;
          if (isLandscape) {
            activeTargetsRef.current = nextWave.buttons;
            setTargetStickAngle(nextWave.stickAngle);
            setStickCompleted(false);
            setPoppedBubbles({});
            const nextLit = {};
            nextWave.buttons.forEach((id) => {
              nextLit[id] = true;
            });
            setLitBubbles(nextLit);
          } else {
            activeTargetsRef.current = nextWave;
            const nextLit = {};
            nextWave.forEach((id) => {
              nextLit[id] = true;
            });
            setPoppedBubbles({});
            setLitBubbles(nextLit);
            soundEngine.playBubbleLight(nextWave[0]);
          }
        } else {
          setGameState('awaiting_trigger');
        }
      }
    }
  };

  const handlePressBackTrigger = () => {
    if (!isPoweredOn) return;

    if (gameState === 'idle' || gameState === 'gameover') {
      soundEngine.playEffect('triggerReset');
      clearAllTimers();
      clearGlobalClock();
      proceduralDirector.resetSession();

      setScore(0);
      setLives(3);
      setLevel(1);
      setSubRound(1);
      setPoppedBubbles({});
      setErrorBubbles({});
      setLitBubbles({});
      setTargetStickAngle(null);
      setStickCompleted(false);

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
          }
        }, 100);
      }

      startRound(1, 1, currentMode.id);
      return;
    }

    if (gameState === 'awaiting_trigger') {
      clearAllTimers();
      soundEngine.playEffect('triggerReset');
      setPoppedBubbles({});
      setErrorBubbles({});
      setLitBubbles({});
      setTargetStickAngle(null);
      setStickCompleted(false);

      const elapsedPlayMs = Math.max(100, Date.now() - roundPlayStartTsRef.current);
      const taps = Math.max(1, roundTapCountRef.current);
      const avgMsPerTap = elapsedPlayMs / taps;

      proceduralDirector.recordRoundPerformance({
        success: true,
        remainingTimeRatio: timerProgress,
        avgMsPerTap,
      });

      if (currentMode.id === 'timeattack') {
        updateScore(Math.round(15 * proceduralDirector.pressureIndex));
        const nextSub = subRound + 1;
        const nextLvl = nextSub > SUB_ROUNDS_PER_LEVEL ? level + 1 : level;
        const wrappedSub = nextSub > SUB_ROUNDS_PER_LEVEL ? 1 : nextSub;
        setLevel(nextLvl);
        setSubRound(wrappedSub);
        startRound(nextLvl, wrappedSub, 'timeattack');
        return;
      }

      const bonusPoints = Math.round(
        10 * proceduralDirector.pressureIndex + timerProgress * 20
      );
      updateScore(bonusPoints);

      if (subRound < SUB_ROUNDS_PER_LEVEL) {
        const nextSub = subRound + 1;
        setSubRound(nextSub);
        const tNext = setTimeout(() => {
          startRound(level, nextSub, currentMode.id);
        }, 360);
        timeoutsRef.current.push(tNext);
      } else {
        const nextLevel = level + 1;
        soundEngine.playEffect('roundSuccess');
        setLevel(nextLevel);
        setSubRound(1);
        const allLit = {};
        for (let i = 0; i < (isLandscape ? 4 : TOTAL_BUBBLES); i++) allLit[i] = true;
        setLitBubbles(allLit);

        const tNextLvl = setTimeout(() => {
          setLitBubbles({});
          startRound(nextLevel, 1, currentMode.id);
        }, 820);
        timeoutsRef.current.push(tNextLvl);
      }
      return;
    }

    if (gameState === 'playing') {
      handleMistake(activeTargetsRef.current);
    }
  };

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
    }
  };

  const handleCycleMode = () => {
    if (!isPoweredOn) return;
    clearAllTimers();
    clearGlobalClock();
    soundEngine.playEffect('modeSwitch');
    proceduralDirector.resetSession();
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
  };

  const handleCycleVolume = () => {
    if (!isPoweredOn) return;
    const nextVol = soundEngine.cycleVolume();
    setVolumeLevel(nextVol);
  };

  if (isLandscape) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar hidden />
        <GamingLandscapeView
          isPoweredOn={isPoweredOn}
          modeIndex={modeIndex}
          volumeLevel={volumeLevel}
          onTogglePower={handleTogglePower}
          onCycleMode={handleCycleMode}
          onCycleVolume={handleCycleVolume}
          level={level}
          subRound={subRound}
          score={score}
          highScore={highScores[currentMode.id] || 0}
          lives={lives}
          gameState={gameState}
          timerProgress={timerProgress}
          timeLeftSeconds={timeLeftSeconds}
          targetStickAngle={targetStickAngle}
          stickCompleted={stickCompleted}
          litActionButtons={litBubbles}
          poppedActionButtons={poppedBubbles}
          errorActionButtons={errorBubbles}
          stickError={stickError}
          lastPrecisionPct={lastPrecisionPct}
          onStickDirectionInput={handleStickDirectionInput}
          onPressActionButton={handlePressBubble}
          onPressTrigger={handlePressBackTrigger}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0b0d12" />
      <View style={styles.screenBackground}>
        <View
          style={[
            styles.consoleBody,
            { width: Math.min(dimensions.width - 24, 400) },
          ]}
        >
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
            gameState={gameState}
            timerProgress={timerProgress}
            timeLeftSeconds={timeLeftSeconds}
          />

          <BubbleGrid
            litBubbles={litBubbles}
            poppedBubbles={poppedBubbles}
            errorBubbles={errorBubbles}
            onPressBubble={handlePressBubble}
            disabled={gameState === 'showing'}
            isPoweredOn={isPoweredOn}
            accentLedColor={currentMode.ledColor}
          />

          <BackTrigger
            isPoweredOn={isPoweredOn}
            gameState={gameState}
            onPressTrigger={handlePressBackTrigger}
            accentColor={currentMode.ledColor}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b0d12',
  },
  screenBackground: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  consoleBody: {
    backgroundColor: '#191c26',
    borderRadius: 56,
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2a3042',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 18,
  },
});
