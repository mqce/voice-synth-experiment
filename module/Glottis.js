
import noise from "./simplex.js";

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
  vibratoAmount: 0.005,
  vibratoFrequency: 6,
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
    this.setupWaveform(0);
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
      this.setupWaveform(lambda);
    }
    var out = this.normalizedLFWaveform(
      timeInWaveform / this.waveformLength
    );
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
    var vibrato = 0;
    vibrato +=
      this.vibratoAmount *
      Math.sin(2 * Math.PI * this.totalTime * this.vibratoFrequency);
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

  setupWaveform: function (lambda) {
    this.frequency =
      this.oldFrequency * (1 - lambda) + this.newFrequency * lambda;
    var tenseness =
      this.oldTenseness * (1 - lambda) + this.newTenseness * lambda;
    this.Rd = 3 * (1 - tenseness);
    this.waveformLength = 1.0 / this.frequency;

    var Rd = this.Rd;
    if (Rd < 0.5) Rd = 0.5;
    if (Rd > 2.7) Rd = 2.7;
    
    // normalized to time = 1, Ee = 1
    var Ra = -0.01 + 0.048 * Rd;
    var Rk = 0.224 + 0.118 * Rd;
    var Rg =
      ((Rk / 4) * (0.5 + 1.2 * Rk)) / (0.11 * Rd - Ra * (0.5 + 1.2 * Rk));

    var Ta = Ra;
    var Tp = 1 / (2 * Rg);
    var Te = Tp + Tp * Rk; //

    var epsilon = 1 / Ta;
    var shift = Math.exp(-epsilon * (1 - Te));
    var Delta = 1 - shift; //divide by this to scale RHS

    var RHSIntegral = (1 / epsilon) * (shift - 1) + (1 - Te) * shift;
    RHSIntegral = RHSIntegral / Delta;

    var totalLowerIntegral = -(Te - Tp) / 2 + RHSIntegral;
    var totalUpperIntegral = -totalLowerIntegral;

    var omega = Math.PI / Tp;
    var s = Math.sin(omega * Te);
    // need E0*e^(alpha*Te)*s = -1 (to meet the return at -1)
    // and E0*e^(alpha*Tp/2) * Tp*2/pi = totalUpperIntegral
    //             (our approximation of the integral up to Tp)
    // writing x for e^alpha,
    // have E0*x^Te*s = -1 and E0 * x^(Tp/2) * Tp*2/pi = totalUpperIntegral
    // dividing the second by the first,
    // letting y = x^(Tp/2 - Te),
    // y * Tp*2 / (pi*s) = -totalUpperIntegral;
    var y = (-Math.PI * s * totalUpperIntegral) / (Tp * 2);
    var z = Math.log(y);
    var alpha = z / (Tp / 2 - Te);
    var E0 = -1 / (s * Math.exp(alpha * Te));
    this.alpha = alpha;
    this.E0 = E0;
    this.epsilon = epsilon;
    this.shift = shift;
    this.Delta = Delta;
    this.Te = Te;
    this.omega = omega;
  },

  normalizedLFWaveform: function (t) {
    let output;
    if (t > this.Te)
      output =
        (-Math.exp(-this.epsilon * (t - this.Te)) + this.shift) / this.Delta;
    else output = this.E0 * Math.exp(this.alpha * t) * Math.sin(this.omega * t);

    return output * this.intensity * this.loudness;
  },
};