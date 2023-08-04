import "./math.js";

let E0 = 0;
let epsilon = 0;
let shift = 0;
let delta = 0;
let Te = 0;
let alpha = 0;
let omega = 0;

export const Waveform = {

  setup(oldFrequency, newFrequency, oldTenseness, newTenseness, lambda) {
    const frequency = oldFrequency * (1 - lambda) + newFrequency * lambda;
    const tenseness = oldTenseness * (1 - lambda) + newTenseness * lambda;
    const waveformLength = 1.0 / frequency;

    const Rd = (3 * (1 - tenseness)).clamp(0.5, 2.7);
    
    // normalized to time = 1, Ee = 1
    const Ra = -0.01 + 0.048 * Rd;
    const Rk = 0.224 + 0.118 * Rd;
    const Rg = ((Rk / 4) * (0.5 + 1.2 * Rk)) / (0.11 * Rd - Ra * (0.5 + 1.2 * Rk));
    const Tp = 1 / (2 * Rg);

    Te = Tp + Tp * Rk; //
    epsilon = 1 / Ra;
    shift = Math.exp(-epsilon * (1 - Te));
    delta = 1 - shift; //divide by this to scale RHS

    const RHSIntegral = ((1 / epsilon) * (shift - 1) + (1 - Te) * shift ) / delta;
    const totalUpperIntegral = Te - Tp / 2 - RHSIntegral;

    omega = Math.PI / Tp;
    const s = Math.sin(omega * Te);
    const y = (-Math.PI * s * totalUpperIntegral) / (Tp * 2);

    alpha = Math.log(y) / (Tp / 2 - Te);
    E0 = -1 / (s * Math.exp(alpha * Te));

    return waveformLength;
  },

  output(t){//normalizedLFWaveform
    let output;
    if (t > Te){
      output = (-Math.exp(-epsilon * (t - Te)) + shift) / delta;
    }else{
      output = E0 * Math.exp(alpha * t) * Math.sin(omega * t);
    }
    return output;
  }
}

