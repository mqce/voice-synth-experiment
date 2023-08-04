
import noise from "./simplex.js";
import { Waveform } from "./Waveform.js";

/**
 * Glottis = 声門
 * 入力はloudnessとfrequencyのみ
 */
let timeInWaveform = 0;

export const Glottis = {

  oldFrequency: 200,
  newFrequency: 200,
  UIFrequency: 200,
  smoothFrequency: 200,

  oldTenseness: 0.6,
  newTenseness: 0.6,
  UITenseness: 0.6,
  
  totalTime: 0,

  intensity: 0,
  loudness: 1,

  alwaysVoice: true,
  autoWobble: true,

  init(sampleRate){
    this.sampleRate = sampleRate;
    document.querySelector('[name="autoVoice"]').addEventListener('change', e => {
      this.alwaysVoice = e.target.checked;
    });
    document.querySelector('[name="autoWobble"]').addEventListener('change', e => {
      this.autoWobble = e.target.checked;
    });
    this.rangeLoudness = document.querySelector('[name="loudness"]');
    this.rangeFrequency = document.querySelector('[name="frequency"]');
    this.waveformLength = Waveform.setup(this.oldFrequency, this.newFrequency, this.oldTenseness, this.newTenseness, 0);
  },

  update(){
    this.updateLoudness();
    this.updateFrequency();
  },

  updateLoudness(){
    const t = this.rangeLoudness.value / 100;
    this.UITenseness = 1 - Math.cos(t * Math.PI * 0.5);
    this.loudness = Math.pow(this.UITenseness, 0.25);
  },

  updateFrequency(){
    this.UIFrequency =  this.rangeFrequency.value;
    if (this.intensity == 0) this.smoothFrequency = this.UIFrequency;
  },

  runStep(lambda, noiseSource) {
    var timeStep = 1.0 / this.sampleRate;
    timeInWaveform += timeStep;
    this.totalTime += timeStep;
    if (timeInWaveform > this.waveformLength) {
      timeInWaveform -= this.waveformLength;
      this.waveformLength = Waveform.setup(this.oldFrequency, this.newFrequency, this.oldTenseness, this.newTenseness, lambda);
    }
    var out = Waveform.output(
      timeInWaveform / this.waveformLength
    ) * this.intensity * this.loudness;;
    var aspiration =
      this.intensity *
      (1 - Math.sqrt(this.UITenseness)) *
      this.getNoiseModulator() *
      noiseSource;
    aspiration *= 0.2 + 0.02 * noise.simplex1(this.totalTime * 1.99);
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
      this.UITenseness * this.intensity * voiced +
      (1 - this.UITenseness * this.intensity) * 0.3
    );
  },

  finishBlock: function () {
    const vibratoFrequency = 6;
    let vibrato = 0.005 * Math.sin(2 * Math.PI * this.totalTime * vibratoFrequency);
    vibrato += 0.02 * noise.simplex1(this.totalTime * 4.07);
    vibrato += 0.04 * noise.simplex1(this.totalTime * 2.15);
    if (this.autoWobble) {
      vibrato += 0.2 * noise.simplex1(this.totalTime * 0.98);
      vibrato += 0.4 * noise.simplex1(this.totalTime * 0.5);
    }
    if (this.UIFrequency > this.smoothFrequency)
      this.smoothFrequency = Math.min(
        this.smoothFrequency * 1.1,
        this.UIFrequency
      );
    if (this.UIFrequency < this.smoothFrequency)
      this.smoothFrequency = Math.max(
        this.smoothFrequency / 1.1,
        this.UIFrequency
      );
    this.oldFrequency = this.newFrequency;
    this.newFrequency = this.smoothFrequency * (1 + vibrato);
    this.oldTenseness = this.newTenseness;
    this.newTenseness =
      this.UITenseness +
      0.1 * noise.simplex1(this.totalTime * 0.46) +
      0.05 * noise.simplex1(this.totalTime * 0.36);
    if (!this.isTouched && this.alwaysVoice)
      this.newTenseness += (3 - this.UITenseness) * (1 - this.intensity);

    if (this.isTouched || this.alwaysVoice) this.intensity += 0.13;
    else this.intensity -= 0.05;
    this.intensity = Math.clamp(this.intensity, 0, 1);
  },

};