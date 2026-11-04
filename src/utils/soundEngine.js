import { Platform, Vibration } from 'react-native';

let AudioModule = null;
let HapticsModule = null;

try {
  AudioModule = require('expo-av').Audio;
} catch (e) {
  // Fallback if expo-av is not linked in the current environment
}

try {
  HapticsModule = require('expo-haptics');
} catch (e) {
  // Fallback to React Native Vibration
}

// 10 musical notes (C major / pentatonic extended across 10 bubbles)
export const BUBBLE_FREQUENCIES = [
  523.25, // Bubble 0: C5
  587.33, // Bubble 1: D5
  659.25, // Bubble 2: E5
  698.46, // Bubble 3: F5
  783.99, // Bubble 4: G5
  880.00, // Bubble 5: A5
  987.77, // Bubble 6: B5
  1046.50, // Bubble 7: C6
  1174.66, // Bubble 8: D6
  1318.51, // Bubble 9: E6
];

const Base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encodeBase64(bytes) {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    result += Base64Chars[b0 >> 2];
    result += Base64Chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < len ? Base64Chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < len ? Base64Chars[b2 & 63] : '=';
  }
  return result;
}

/**
 * Generates a mono 16-bit PCM WAV data URI from a sequence of tone segments.
 * Each segment: { freq, endFreq, durationMs, type: 'sine'|'triangle'|'square', gain }
 */
function generateWavDataUri(segments, masterGain = 0.8) {
  const sampleRate = 22050;
  let totalSamples = 0;
  const segSamples = segments.map((s) => {
    const count = Math.max(1, Math.floor((s.durationMs / 1000) * sampleRate));
    totalSamples += count;
    return { ...s, count };
  });

  const dataSize = totalSamples * 2;
  const buffer = new Uint8Array(44 + dataSize);
  const view = new DataView(buffer.buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  let phase = 0;

  for (const seg of segSamples) {
    const { freq = 440, endFreq, count, type = 'sine', gain = 1.0 } = seg;
    for (let i = 0; i < count; i++) {
      const progress = i / count;
      const currentFreq = endFreq ? freq + (endFreq - freq) * progress : freq;
      // Smooth attack & exponential release envelope
      const attack = Math.min(1, i / (sampleRate * 0.008));
      const release = Math.pow(1 - progress, 1.6);
      const env = attack * release * gain * masterGain;

      let sample = 0;
      if (currentFreq > 0) {
        phase += (2 * Math.PI * currentFreq) / sampleRate;
        if (type === 'square') {
          sample = Math.sin(phase) >= 0 ? 0.6 : -0.6;
        } else if (type === 'triangle') {
          sample = (2 / Math.PI) * Math.asin(Math.sin(phase));
        } else {
          // Rich sine + subtle Pop harmonic
          sample = Math.sin(phase) * 0.8 + Math.sin(phase * 2) * 0.2;
        }
      }

      const pcm = Math.max(-1, Math.min(1, sample * env));
      view.setInt16(offset, pcm * 32767, true);
      offset += 2;
    }
  }

  return 'data:audio/wav;base64,' + encodeBase64(buffer);
}

class SoundAndHapticsEngine {
  constructor() {
    this.volumeLevel = 3; // 0 = Mute, 1 = Low, 2 = Medium, 3 = High
    this.webAudioCtx = null;
    this.cachedBubbleUris = {};
    this.cachedEffectUris = {};
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    if (AudioModule && Platform.OS !== 'web') {
      try {
        await AudioModule.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        // Ignore audio mode errors
      }
    }

    // Pre-build WAV data URIs for native playback
    BUBBLE_FREQUENCIES.forEach((freq, idx) => {
      // Light-up sequence chime
      this.cachedBubbleUris[`light_${idx}`] = generateWavDataUri([
        { freq, endFreq: freq * 1.02, durationMs: 165, type: 'triangle', gain: 0.9 },
      ]);
      // Finger pop sound (silicone pop pitch bend + note)
      this.cachedBubbleUris[`pop_${idx}`] = generateWavDataUri([
        { freq: freq * 0.75, endFreq: freq * 1.35, durationMs: 65, type: 'sine', gain: 1.0 },
        { freq: freq, endFreq: freq * 1.05, durationMs: 95, type: 'triangle', gain: 0.85 },
      ]);
    });

    this.cachedEffectUris.triggerReset = generateWavDataUri([
      { freq: 240, endFreq: 580, durationMs: 90, type: 'triangle', gain: 0.95 },
      { freq: 620, endFreq: 880, durationMs: 85, type: 'sine', gain: 0.9 },
    ]);

    this.cachedEffectUris.roundSuccess = generateWavDataUri([
      { freq: 523.25, durationMs: 90, type: 'triangle', gain: 0.85 },
      { freq: 659.25, durationMs: 90, type: 'triangle', gain: 0.85 },
      { freq: 783.99, durationMs: 90, type: 'triangle', gain: 0.9 },
      { freq: 1046.5, durationMs: 210, type: 'triangle', gain: 1.0 },
    ]);

    this.cachedEffectUris.fail = generateWavDataUri([
      { freq: 310, endFreq: 210, durationMs: 180, type: 'square', gain: 0.8 },
      { freq: 195, endFreq: 130, durationMs: 320, type: 'square', gain: 0.9 },
    ]);

    this.cachedEffectUris.powerOn = generateWavDataUri([
      { freq: 440, durationMs: 80, type: 'sine', gain: 0.8 },
      { freq: 554.37, durationMs: 80, type: 'sine', gain: 0.85 },
      { freq: 659.25, durationMs: 100, type: 'sine', gain: 0.9 },
      { freq: 880, durationMs: 180, type: 'triangle', gain: 1.0 },
    ]);

    this.cachedEffectUris.powerOff = generateWavDataUri([
      { freq: 880, durationMs: 90, type: 'sine', gain: 0.85 },
      { freq: 659.25, durationMs: 90, type: 'sine', gain: 0.8 },
      { freq: 440, durationMs: 160, type: 'sine', gain: 0.75 },
    ]);

    this.cachedEffectUris.modeSwitch = generateWavDataUri([
      { freq: 698.46, durationMs: 70, type: 'triangle', gain: 0.85 },
      { freq: 880, durationMs: 110, type: 'triangle', gain: 0.9 },
    ]);
  }

  getVolumeScalar() {
    if (this.volumeLevel === 0) return 0;
    if (this.volumeLevel === 1) return 0.25;
    if (this.volumeLevel === 2) return 0.6;
    return 1.0;
  }

  cycleVolume() {
    this.volumeLevel = (this.volumeLevel + 1) % 4;
    if (this.volumeLevel > 0) {
      this.playEffect('modeSwitch');
    }
    this.triggerHaptic('selection');
    return this.volumeLevel;
  }

  triggerHaptic(style = 'pop') {
    try {
      if (HapticsModule && Platform.OS !== 'web') {
        if (style === 'pop') {
          HapticsModule.impactAsync(HapticsModule.ImpactFeedbackStyle.Medium);
        } else if (style === 'heavy') {
          HapticsModule.impactAsync(HapticsModule.ImpactFeedbackStyle.Heavy);
        } else if (style === 'success') {
          HapticsModule.notificationAsync(HapticsModule.NotificationFeedbackType.Success);
        } else if (style === 'error') {
          HapticsModule.notificationAsync(HapticsModule.NotificationFeedbackType.Error);
        } else {
          HapticsModule.selectionAsync();
        }
        return;
      }
    } catch (e) {
      // Fallback below
    }

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(style === 'error' ? [60, 40, 90] : style === 'heavy' ? 45 : 22);
      } else {
        Vibration.vibrate(style === 'error' ? 120 : style === 'heavy' ? 45 : 20);
      }
    } catch (e) {
      // Ignore on unsupported devices
    }
  }

  playWebTone(segments) {
    const vol = this.getVolumeScalar();
    if (vol <= 0) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.webAudioCtx) {
        this.webAudioCtx = new AudioCtx();
      }
      if (this.webAudioCtx.state === 'suspended') {
        this.webAudioCtx.resume();
      }

      let startTime = this.webAudioCtx.currentTime;
      segments.forEach((seg) => {
        const dur = (seg.durationMs || 100) / 1000;
        const osc = this.webAudioCtx.createOscillator();
        const gainNode = this.webAudioCtx.createGain();

        osc.type = seg.type || 'sine';
        osc.frequency.setValueAtTime(seg.freq || 440, startTime);
        if (seg.endFreq) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, seg.endFreq), startTime + dur);
        }

        const peakGain = (seg.gain || 0.8) * vol * 0.35;
        gainNode.gain.setValueAtTime(0.001, startTime);
        gainNode.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.012, dur * 0.2));
        gainNode.gain.exponentialRampToValueAtTime(0.0008, startTime + dur);

        osc.connect(gainNode);
        gainNode.connect(this.webAudioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + dur);
        startTime += dur * 0.92;
      });
    } catch (e) {
      // Ignore web audio errors
    }
  }

  async playUri(uri, webFallbackSegments) {
    await this.init();
    const vol = this.getVolumeScalar();
    if (vol <= 0) return;

    if (Platform.OS === 'web' || !AudioModule) {
      this.playWebTone(webFallbackSegments);
      return;
    }

    try {
      const { sound } = await AudioModule.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: vol }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (e) {
      this.playWebTone(webFallbackSegments);
    }
  }

  playBubbleLight(index) {
    const idx = index % BUBBLE_FREQUENCIES.length;
    const freq = BUBBLE_FREQUENCIES[idx];
    this.playUri(this.cachedBubbleUris[`light_${idx}`], [
      { freq, endFreq: freq * 1.02, durationMs: 165, type: 'triangle', gain: 0.9 },
    ]);
  }

  playBubblePop(index) {
    const idx = index % BUBBLE_FREQUENCIES.length;
    const freq = BUBBLE_FREQUENCIES[idx];
    this.triggerHaptic('pop');
    this.playUri(this.cachedBubbleUris[`pop_${idx}`], [
      { freq: freq * 0.75, endFreq: freq * 1.35, durationMs: 65, type: 'sine', gain: 1.0 },
      { freq, endFreq: freq * 1.05, durationMs: 95, type: 'triangle', gain: 0.85 },
    ]);
  }

  playEffect(effectName) {
    const fallbackMap = {
      triggerReset: [
        { freq: 240, endFreq: 580, durationMs: 90, type: 'triangle', gain: 0.95 },
        { freq: 620, endFreq: 880, durationMs: 85, type: 'sine', gain: 0.9 },
      ],
      roundSuccess: [
        { freq: 523.25, durationMs: 90, type: 'triangle', gain: 0.85 },
        { freq: 659.25, durationMs: 90, type: 'triangle', gain: 0.85 },
        { freq: 783.99, durationMs: 90, type: 'triangle', gain: 0.9 },
        { freq: 1046.5, durationMs: 210, type: 'triangle', gain: 1.0 },
      ],
      fail: [
        { freq: 310, endFreq: 210, durationMs: 180, type: 'square', gain: 0.8 },
        { freq: 195, endFreq: 130, durationMs: 320, type: 'square', gain: 0.9 },
      ],
      powerOn: [
        { freq: 440, durationMs: 80, type: 'sine', gain: 0.8 },
        { freq: 554.37, durationMs: 80, type: 'sine', gain: 0.85 },
        { freq: 659.25, durationMs: 100, type: 'sine', gain: 0.9 },
        { freq: 880, durationMs: 180, type: 'triangle', gain: 1.0 },
      ],
      powerOff: [
        { freq: 880, durationMs: 90, type: 'sine', gain: 0.85 },
        { freq: 659.25, durationMs: 90, type: 'sine', gain: 0.8 },
        { freq: 440, durationMs: 160, type: 'sine', gain: 0.75 },
      ],
      modeSwitch: [
        { freq: 698.46, durationMs: 70, type: 'triangle', gain: 0.85 },
        { freq: 880, durationMs: 110, type: 'triangle', gain: 0.9 },
      ],
    };

    if (effectName === 'triggerReset') this.triggerHaptic('heavy');
    else if (effectName === 'roundSuccess') this.triggerHaptic('success');
    else if (effectName === 'fail') this.triggerHaptic('error');
    else this.triggerHaptic('selection');

    this.playUri(this.cachedEffectUris[effectName], fallbackMap[effectName] || fallbackMap.modeSwitch);
  }
}

export const soundEngine = new SoundAndHapticsEngine();
