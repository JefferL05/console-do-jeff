// Original procedural country/folk loop: plucked strings, alternating bass,
// shaker and a soft backbeat. No downloads or timer-based audio scheduling.
export const MUSIC = Object.freeze({ bpm: 120, bars: 16, sampleRate: 22050 });
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

export function composeMusic() {
  const beat = 60 / MUSIC.bpm;
  const samples = new Float32Array(Math.round(MUSIC.bars * 4 * beat * MUSIC.sampleRate));
  let seed = 72531;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  function mix(start, duration, sound) {
    const offset = Math.round(start * MUSIC.sampleRate), length = Math.ceil(duration * MUSIC.sampleRate);
    for (let i = 0; i < length; i++) {
      const time = i / MUSIC.sampleRate;
      // Wrap the release into the start of the loop for a continuous musical seam.
      samples[(offset + i) % samples.length] += sound(time, time / duration);
    }
  }
  function pluck(midi, at, amplitude, duration = .38) {
    const hz = frequency(midi);
    mix(at, duration, (time, fraction) => {
      const phase = 2 * Math.PI * hz * time;
      const attack = Math.min(1, time / .004);
      const envelope = attack * Math.exp(-time * 11) * (1 - fraction) ** 2;
      return amplitude * envelope * (Math.sin(phase) + .4 * Math.sin(phase * 2) + .2 * Math.sin(phase * 3) + .09 * Math.sin(phase * 5));
    });
  }
  function bass(midi, at) {
    const hz = frequency(midi);
    mix(at, .36, (time, fraction) => .32 * Math.min(1, time / .012) * Math.exp(-time * 5) * (1 - fraction) * (Math.sin(2 * Math.PI * hz * time) + .18 * Math.sin(4 * Math.PI * hz * time)));
  }
  // G / C / G / D / Em / C / G / D. A second phrase answers the first.
  const chords = [[43, 55, 59, 62], [48, 55, 60, 64], [43, 55, 59, 62], [38, 57, 62, 66], [40, 55, 59, 64], [48, 55, 60, 64], [43, 55, 59, 62], [38, 57, 62, 66]];
  const melody = [
    [67, 71, 74, 71, 69, 67, 71, 74], [76, 72, 69, 67, 69, 72, 76, 74],
    [71, 74, 79, 74, 76, 74, 71, 67], [69, 74, 78, 76, 74, 69, 66, 69],
    [71, 76, 79, 76, 74, 71, 67, 71], [72, 76, 79, 76, 74, 72, 69, 67],
    [71, 74, 76, 74, 71, 69, 67, 71], [69, 66, 62, 66, 69, 74, 69, 66],
    [74, 71, 67, 71, 74, 79, 76, 74], [72, 76, 79, 76, 72, 69, 67, 69],
    [67, 71, 74, 79, 78, 76, 74, 71], [69, 74, 78, 74, 69, 66, 69, 74],
    [76, 71, 67, 71, 74, 76, 79, 76], [76, 72, 69, 72, 74, 76, 72, 69],
    [67, 71, 74, 71, 69, 67, 62, 67], [66, 69, 74, 69, 66, 62, 66, 69],
  ];
  for (let bar = 0; bar < MUSIC.bars; bar++) {
    const at = bar * 4 * beat, chord = chords[bar % chords.length];
    for (let quarter = 0; quarter < 4; quarter++) {
      const time = at + quarter * beat;
      bass(chord[0] + (quarter % 2 ? 7 : 0), time);
      // Short off-beat strums complement the picked melody.
      chord.slice(1).forEach((note, index) => pluck(note, time + beat * .54 + index * .009, .11, .22));
      mix(time, .11, (t, fraction) => .15 * Math.sin(2 * Math.PI * (62 * t - 90 * t * t)) * (1 - fraction) ** 3);
      if (quarter % 2) mix(time, .085, (t, fraction) => (.08 * noise() + .08 * Math.sin(2 * Math.PI * 175 * t)) * Math.min(1, t / .003) * (1 - fraction) ** 3);
    }
    for (let eighth = 0; eighth < 8; eighth++) {
      const time = at + (Math.floor(eighth / 2) + (eighth % 2 ? .54 : 0)) * beat;
      pluck(melody[bar][eighth], time, eighth % 2 ? .19 : .24);
      mix(time, .035, (t, fraction) => .037 * noise() * Math.min(1, t / .002) * (1 - fraction) ** 2);
    }
  }
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const scale = .8 / Math.max(peak, .8);
  for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  return samples;
}

export function createMusic(context) {
  const data = composeMusic();
  const buffer = context.createBuffer(1, data.length, MUSIC.sampleRate);
  buffer.copyToChannel(data, 0);
  const source = context.createBufferSource(), gain = context.createGain();
  source.buffer = buffer; source.loop = true; gain.gain.value = 0;
  source.connect(gain); gain.connect(context.destination);
  let started = false;
  return {
    setEnabled(enabled) {
      if (enabled && !started) { source.start(); started = true; }
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setTargetAtTime(enabled ? .32 : 0, context.currentTime, .025);
    },
  };
}
