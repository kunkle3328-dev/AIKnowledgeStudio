
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Android Stability Fix: Prevents popping and auto-restarts by smoothing transitions.
 * Mimics the AudioEngine.kt smoothPCM logic.
 */
export function smoothPCM(pcm: Float32Array): Float32Array {
  const out = new Float32Array(pcm.length);
  if (pcm.length === 0) return out;
  out[0] = pcm[0];
  for (let i = 1; i < pcm.length; i++) {
    out[i] = (pcm[i] + pcm[i - 1]) / 2;
  }
  return out;
}

/**
 * Creates a small silence buffer to prevent AudioContext from suspending during stream gaps.
 * Matches silenceFrame logic in AudioEngine.kt.
 */
export function getSilenceBuffer(ctx: AudioContext, duration: number = 0.02): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.floor(sampleRate * duration);
  return ctx.createBuffer(1, frameCount, sampleRate);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    const rawData = new Float32Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      rawData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    // Apply smoothing to the entire decoded chunk
    const smoothed = smoothPCM(rawData);
    channelData.set(smoothed);
  }
  return buffer;
}

export function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  const smoothedData = smoothPCM(data);
  for (let i = 0; i < l; i++) {
    int16[i] = smoothedData[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
