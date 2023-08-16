
import noise from "./simplex.js";
import { Waveform } from "./Waveform.js";

/**
 * Glottis = 声門
 * 入力はloudnessとfrequencyのみ
 */
let timeInWaveform = 0;
let totalTime = 0;

let UI;
let input = {};

let oldFrequency = 0;
let newFrequency = 0;
let smoothFrequency = 0;

let oldTenseness = 0.6;
let newTenseness = 0.6;
let UITenseness = 0.6;

export const Glottis = {

  sampleRate : 0,
  intensity: 0,
  loudness: 0,

  init(ui, sampleRate){
    UI = ui;
    this.sampleRate = sampleRate;
    input = UI.get();
    oldFrequency = newFrequency = input.frequency;

    this.waveformLength = Waveform.setup(oldFrequency, newFrequency, oldTenseness, newTenseness, 0);
  },

  update(){
    input = UI.get();
    this.updateLoudness(input.loudness);
    if (this.intensity == 0) smoothFrequency = input.frequency;
  },

  updateLoudness(inputValue){
    const t = inputValue / 100;
    UITenseness = 1 - Math.cos(t * Math.PI * 0.5);
    this.loudness = Math.pow(UITenseness, 0.25);
  },

  runStep(noiseSource, lambda) {
    var timeStep = 1.0 / this.sampleRate;
    timeInWaveform += timeStep;
    totalTime += timeStep;
    if (timeInWaveform > this.waveformLength) {
      timeInWaveform -= this.waveformLength;
      this.waveformLength = Waveform.setup(oldFrequency, newFrequency, oldTenseness, newTenseness, lambda);
    }
    var out = Waveform.output(
      timeInWaveform / this.waveformLength
    ) * this.intensity * this.loudness;

    // 呼吸
    var aspiration =
      this.intensity *
      (1 - Math.sqrt(UITenseness)) *
      this.getNoiseModulator() *
      noiseSource;
    aspiration *= 0.2 + 0.02 * noise.simplex1(totalTime * 1.99);
    out += aspiration;
    
    return out;
  },

  getNoiseModulator: function () {
    var voiced =
      0.1 +
      0.2 *
        Math.max(
          0,
          Math.sin((Math.PI * 2 * timeInWaveform) / this.waveformLength)
        );
    //return 0.3;
    return (
      UITenseness * this.intensity * voiced +
      (1 - UITenseness * this.intensity) * 0.3
    );
  },

  finishBlock: function () {
    const vibratoFrequency = 6;
    let vibrato = 0.005 * Math.sin(2 * Math.PI * totalTime * vibratoFrequency);
    vibrato += 0.02 * noise.simplex1(totalTime * 4.07);
    vibrato += 0.04 * noise.simplex1(totalTime * 2.15);
    if (input.autoWobble) {
      vibrato += 0.2 * noise.simplex1(totalTime * 0.98);
      vibrato += 0.4 * noise.simplex1(totalTime * 0.5);
    }
    if (input.frequency > smoothFrequency)
      smoothFrequency = Math.min(
        smoothFrequency * 1.1,
        input.frequency
      );
    if (input.frequency < smoothFrequency)
      smoothFrequency = Math.max(
        smoothFrequency / 1.1,
        input.frequency
      );
    oldFrequency = newFrequency;
    newFrequency = smoothFrequency * (1 + vibrato);
    oldTenseness = newTenseness;
    newTenseness =
      UITenseness +
      0.1 * noise.simplex1(totalTime * 0.46) +
      0.05 * noise.simplex1(totalTime * 0.36);
    if (!this.isTouched && input.alwaysVoice)
      newTenseness += (3 - UITenseness) * (1 - this.intensity);

    if (this.isTouched || input.alwaysVoice) this.intensity += 0.13;
    else this.intensity -= 0.05;
    this.intensity = Math.clamp(this.intensity, 0, 1);
  },

};