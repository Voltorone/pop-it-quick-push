/**
 * Procedural Adaptive Difficulty Engine (AI Director)
 *
 * Dynamically mutates level progression on every new game session using:
 * 1. Session Procedural DNA (random seed & mutation weights per run)
 * 2. Real-time Player Performance Telemetry (reaction time ratio, tap cadence, streak, accuracy)
 * 3. Spatial 2D Graph of the 3-4-3 bubble matrix (controlling neighbor vs. cross-pad jumps)
 * 4. Unbounded infinite scaling until the player reaches their physiological limit.
 */

// 2D coordinates of the 10 bubbles in the 3-4-3 layout
const BUBBLE_COORDS = [
  { x: 0.5, y: 0 }, { x: 1.5, y: 0 }, { x: 2.5, y: 0 },          // Row 0 (3 bubbles)
  { x: 0.0, y: 1 }, { x: 1.0, y: 1 }, { x: 2.0, y: 1 }, { x: 3.0, y: 1 }, // Row 1 (4 bubbles)
  { x: 0.5, y: 2 }, { x: 1.5, y: 2 }, { x: 2.5, y: 2 },          // Row 2 (3 bubbles)
];

function euclideanDistance(a, b) {
  const dx = BUBBLE_COORDS[a].x - BUBBLE_COORDS[b].x;
  const dy = BUBBLE_COORDS[a].y - BUBBLE_COORDS[b].y;
  return Math.sqrt(dx * dx + dy * dy);
}

export class ProceduralDirector {
  constructor() {
    this.resetSession();
  }

  /**
   * Initializes a new game session with a unique procedural mutation profile
   * so that every run scales differently even at the same level number.
   */
  resetSession() {
    // Procedural DNA weights unique to this run (0.82 to 1.22)
    this.sessionDna = {
      speedMutator: 0.85 + Math.random() * 0.35,      // Biases timer & flash speed
      lengthMutator: 0.85 + Math.random() * 0.35,     // Biases sequence / cluster size
      spatialMutator: Math.random(),                  // 0 = ergonomic clusters, 1 = wide jumps
      cadenceVariance: Math.random() * 0.25,          // Syncopated rhythm variation in Memory mode
    };

    // Real-time player performance metrics
    this.skillRating = 1.0;        // Starts at 1.0; scales up if player is fast/accurate
    this.pressureIndex = 1.0;      // Combined procedural difficulty score (grows to infinity)
    this.streak = 0;
    this.totalRoundsCleared = 0;
    this.recentReactionRatios = [];
  }

  /**
   * Records how the player performed on the round that just finished.
   * @param {object} metrics
   * @param {boolean} metrics.success - Whether the round was cleared without error
   * @param {number} metrics.remainingTimeRatio - 0.0 (barely made it) to 1.0 (instant)
   * @param {number} metrics.avgMsPerTap - Average milliseconds per bubble tap
   */
  recordRoundPerformance({ success, remainingTimeRatio = 0.5, avgMsPerTap = 450 }) {
    if (success) {
      this.streak += 1;
      this.totalRoundsCleared += 1;
      this.recentReactionRatios.push(remainingTimeRatio);
      if (this.recentReactionRatios.length > 5) {
        this.recentReactionRatios.shift();
      }

      const avgRemaining =
        this.recentReactionRatios.reduce((a, b) => a + b, 0) /
        this.recentReactionRatios.length;

      // Fast completion (<350ms/tap or >55% timer left) accelerates skillRating faster
      const speedBonus = Math.max(0, (remainingTimeRatio - 0.35) * 0.45);
      const cadenceBonus = avgMsPerTap < 360 ? 0.18 : avgMsPerTap < 500 ? 0.08 : 0.02;
      const streakMultiplier = 1 + Math.min(0.6, this.streak * 0.06);

      // Re-roll subtle procedural drift every round so the curve feels organic and unpredictable
      const proceduralDrift = 0.92 + Math.random() * 0.22;

      this.skillRating += (0.14 + speedBonus + cadenceBonus) * streakMultiplier * proceduralDrift;

      // If player is cruising (avgRemaining > 0.65), inject an extra surge
      if (avgRemaining > 0.65 && this.streak >= 3) {
        this.skillRating += 0.22 * this.sessionDna.speedMutator;
      }
    } else {
      // On mistake: reset streak and slightly temper skillRating so next retry is fair,
      // while keeping overall progression high
      this.streak = 0;
      this.skillRating = Math.max(0.85, this.skillRating * 0.88);
    }
  }

  /**
   * Computes the procedural parameters for the upcoming round.
   */
  generateRoundParams(level, subRound, modeId) {
    // Combine base level progression + adaptive player skillRating + session DNA jitter
    const baseProgression = (level - 1) * 1.15 + (subRound - 1) * 0.22;
    const sessionJitter = 0.9 + Math.random() * 0.25;
    this.pressureIndex = (1 + baseProgression * 0.65 + (this.skillRating - 1) * 0.85) * sessionJitter;

    // Spatial jump preference (0 = prefers nearby bubbles, 1 = prefers distant cross-pad leaps)
    const spatialAggression = Math.min(
      0.95,
      0.2 + this.sessionDna.spatialMutator * 0.35 + (this.pressureIndex - 1) * 0.09
    );

    if (modeId === 'memory') {
      // Unbounded sequence length scaling with level, skillRating, and lengthMutator
      const rawLength =
        2 +
        this.pressureIndex * 0.92 * this.sessionDna.lengthMutator +
        (Math.random() < 0.35 ? 1 : 0);
      const seqLength = Math.max(2, Math.round(rawLength));

      // Flash duration decays asymptotically toward 105ms
      const baseFlashMs =
        105 +
        430 / (1 + (this.pressureIndex - 1) * 0.32 * this.sessionDna.speedMutator);
      const flashGapMs = Math.max(
        55,
        Math.round(baseFlashMs * (0.34 + (Math.random() - 0.5) * this.sessionDna.cadenceVariance))
      );

      const sequence = this.buildProceduralSequence(seqLength, spatialAggression);

      // Variable per-step timing (at higher pressure, introduces subtle syncopated rhythm)
      const stepTimings = sequence.map(() => {
        const rhythmJitter =
          this.pressureIndex > 3.5
            ? 1 + (Math.random() - 0.5) * this.sessionDna.cadenceVariance
            : 1;
        return {
          onMs: Math.max(100, Math.round(baseFlashMs * rhythmJitter)),
          gapMs: flashGapMs,
        };
      });

      // Player response time window per tap shrinks as skill & pressure grow
      const msPerStepAllowed =
        290 + 980 / (1 + (this.pressureIndex - 1) * 0.28 * this.sessionDna.speedMutator);
      const allowedTimeMs = Math.max(
        1600,
        Math.round(seqLength * msPerStepAllowed + 950)
      );

      return {
        sequence,
        stepTimings,
        allowedTimeMs,
        pressureIndex: this.pressureIndex,
      };
    }

    if (modeId === 'reflex') {
      // Number of simultaneous bubbles (1 up to 9) + multi-wave chaining at high pressure!
      const rawTargets =
        1.5 + this.pressureIndex * 0.78 * this.sessionDna.lengthMutator;
      const targetCount = Math.max(
        1,
        Math.min(9, Math.round(rawTargets + (Math.random() - 0.35)))
      );

      // At higher pressure levels, a single round can require clearing 2 or 3 consecutive waves
      // before pushing the Back Trigger!
      const waveCount =
        this.pressureIndex > 6.5 && Math.random() < 0.55
          ? 2 + Math.floor((this.pressureIndex - 6.5) / 5)
          : 1;

      const waves = [];
      for (let w = 0; w < waveCount; w++) {
        waves.push(this.buildSpatialCluster(targetCount, spatialAggression));
      }

      // Asymptotic reaction window per wave (shrinks toward human reflex limit ~240ms/bubble + 380ms base)
      const msPerBubble =
        210 + 620 / (1 + (this.pressureIndex - 1) * 0.36 * this.sessionDna.speedMutator);
      const baseReactionMs =
        360 + 1400 / (1 + (this.pressureIndex - 1) * 0.32 * this.sessionDna.speedMutator);
      const timeLimitMs = Math.max(
        680,
        Math.round(waveCount * (baseReactionMs + targetCount * msPerBubble))
      );

      return {
        waves,
        timeLimitMs,
        pressureIndex: this.pressureIndex,
      };
    }

    // Time Attack (60s) mode: scales cluster size and spatial spread based on current streak & skill
    const taCount = Math.max(
      2,
      Math.min(8, Math.round(2 + (this.pressureIndex - 1) * 0.55 + Math.random() * 1.5))
    );
    const targets = this.buildSpatialCluster(taCount, spatialAggression);
    return {
      waves: [targets],
      pressureIndex: this.pressureIndex,
    };
  }

  /**
   * Generates procedural parameters for Horizontal Gaming Mode:
   * Left hand: Joystick target angle (0..360 deg) + angular precision tolerance
   * Right hand: 4 shooter action buttons (indices 0..3)
   */
  generateGamingRoundParams(level, subRound, modeId) {
    const baseProg = (level - 1) * 1.15 + (subRound - 1) * 0.22;
    const jitter = 0.9 + Math.random() * 0.25;
    this.pressureIndex =
      (1 + baseProg * 0.65 + (this.skillRating - 1) * 0.85) * jitter;

    // Angular tolerance tightens as player skill & level increase (from ±28° down to ±11°)
    const angleToleranceDeg = Math.max(
      11,
      Math.round(28 - (this.pressureIndex - 1) * 1.8)
    );

    // At lower levels use 8 cardinal/diagonal angles (45° steps); at high pressure unlock 15° micro-angles
    const stepDeg = this.pressureIndex > 4.0 ? 15 : 45;
    const numAngles = Math.round(360 / stepDeg);
    const randomAngle = () => (Math.floor(Math.random() * numAngles) * stepDeg) % 360;

    if (modeId === 'memory') {
      const seqLen = Math.max(
        2,
        Math.round(2 + this.pressureIndex * 0.85 * this.sessionDna.lengthMutator)
      );
      const baseFlashMs =
        120 +
        420 / (1 + (this.pressureIndex - 1) * 0.32 * this.sessionDna.speedMutator);
      const gapMs = Math.max(65, Math.round(baseFlashMs * 0.35));

      // Sequence alternates/mixes Left-Hand Joystick directions and Right-Hand 4 buttons
      const steps = [];
      let prevKey = '';
      for (let i = 0; i < seqLen; i++) {
        const isStick = i % 2 === 0 || Math.random() < 0.45;
        if (isStick) {
          let ang = randomAngle();
          if (`S_${ang}` === prevKey) ang = (ang + stepDeg) % 360;
          prevKey = `S_${ang}`;
          steps.push({ type: 'stick', angle: ang });
        } else {
          let btn = Math.floor(Math.random() * 4);
          if (`B_${btn}` === prevKey) btn = (btn + 1) % 4;
          prevKey = `B_${btn}`;
          steps.push({ type: 'btn', index: btn });
        }
      }

      const allowedTimeMs = Math.max(
        1800,
        Math.round(seqLen * (baseFlashMs + 520) + 1000)
      );

      return {
        steps,
        flashOnMs: Math.round(baseFlashMs),
        flashGapMs: gapMs,
        allowedTimeMs,
        angleToleranceDeg,
        pressureIndex: this.pressureIndex,
      };
    }

    // Reflex & TimeAttack: Simultaneous Joystick Vector + 1 to 3 Right-Hand Shooter Buttons
    const btnCount = Math.max(
      1,
      Math.min(3, Math.round(1 + (this.pressureIndex - 1) * 0.35 * this.sessionDna.lengthMutator))
    );
    const waveCount =
      modeId === 'reflex' && this.pressureIndex > 5.5 && Math.random() < 0.5
        ? 2
        : 1;

    const waves = [];
    for (let w = 0; w < waveCount; w++) {
      const pool = [0, 1, 2, 3];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      waves.push({
        stickAngle: randomAngle(),
        buttons: pool.slice(0, btnCount),
      });
    }

    const timeLimitMs = Math.max(
      780,
      Math.round(
        waveCount *
          (650 + 1850 / (1 + (this.pressureIndex - 1) * 0.34 * this.sessionDna.speedMutator))
      )
    );

    return {
      waves,
      timeLimitMs,
      angleToleranceDeg,
      pressureIndex: this.pressureIndex,
    };
  }

  /**
   * Builds a sequence of bubble indices where the probability of jumping far across
   * the 3-4-3 pad vs. picking adjacent bubbles is controlled by spatialAggression.
   */
  buildProceduralSequence(length, spatialAggression) {
    const seq = [];
    let current = Math.floor(Math.random() * 10);
    seq.push(current);

    for (let i = 1; i < length; i++) {
      const candidates = [];
      let weightSum = 0;

      for (let idx = 0; idx < 10; idx++) {
        if (idx === current) continue; // Avoid immediate duplicate
        const dist = euclideanDistance(current, idx); // ~1.0 to 3.2
        // When spatialAggression is low (<0.4), favor closer bubbles; when high (>0.6), favor far leaps
        const weight =
          spatialAggression >= 0.5
            ? Math.pow(dist, 1.5 * spatialAggression)
            : Math.pow(3.5 - dist, 1.5 * (1 - spatialAggression));
        candidates.push({ idx, weight });
        weightSum += weight;
      }

      let r = Math.random() * weightSum;
      let chosen = candidates[candidates.length - 1].idx;
      for (const c of candidates) {
        r -= c.weight;
        if (r <= 0) {
          chosen = c.idx;
          break;
        }
      }
      seq.push(chosen);
      current = chosen;
    }

    return seq;
  }

  /**
   * Builds a set of distinct simultaneous bubbles weighted by spatialAggression.
   */
  buildSpatialCluster(count, spatialAggression) {
    const clamped = Math.max(1, Math.min(9, count));
    const selected = [Math.floor(Math.random() * 10)];

    while (selected.length < clamped) {
      const last = selected[selected.length - 1];
      const candidates = [];
      let weightSum = 0;

      for (let idx = 0; idx < 10; idx++) {
        if (selected.includes(idx)) continue;
        const dist = euclideanDistance(last, idx);
        const weight =
          spatialAggression >= 0.5
            ? Math.pow(dist, 1.35 * spatialAggression)
            : Math.pow(3.5 - dist, 1.35 * (1 - spatialAggression));
        candidates.push({ idx, weight });
        weightSum += weight;
      }

      let r = Math.random() * weightSum;
      let chosen = candidates[0].idx;
      for (const c of candidates) {
        r -= c.weight;
        if (r <= 0) {
          chosen = c.idx;
          break;
        }
      }
      selected.push(chosen);
    }

    return selected;
  }
}

export const proceduralDirector = new ProceduralDirector();
