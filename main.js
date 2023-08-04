import "./style.css";
import "./module/math.js";
import { UI } from "./module/UI.js";
import { GlottisUI } from "./module/GlottisUI.js";
import { Glottis } from "./module/Glottis.js";

var sampleRate;
var time = 0;

var AudioSystem = {
  blockLength: 512,
  blockTime: 1,
  started: false,

  init: function () {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new window.AudioContext();
    sampleRate = this.audioContext.sampleRate;
    this.blockTime = this.blockLength / sampleRate;
  },

  startSound: function () {
    //scriptProcessor may need a dummy input channel on iOS
    this.scriptProcessor = this.audioContext.createScriptProcessor(
      this.blockLength,
      2,
      1
    );
    this.scriptProcessor.connect(this.audioContext.destination);
    this.scriptProcessor.onaudioprocess = AudioSystem.doScriptProcessor;

    var whiteNoise = this.createWhiteNoiseNode(2 * sampleRate); // 2 seconds of noise

    var aspirateFilter = this.audioContext.createBiquadFilter();
    aspirateFilter.type = "bandpass";
    aspirateFilter.frequency.value = 500;
    aspirateFilter.Q.value = 0.5;
    whiteNoise.connect(aspirateFilter);
    aspirateFilter.connect(this.scriptProcessor);

    var fricativeFilter = this.audioContext.createBiquadFilter();
    fricativeFilter.type = "bandpass";
    fricativeFilter.frequency.value = 1000;
    fricativeFilter.Q.value = 0.5;
    whiteNoise.connect(fricativeFilter);
    fricativeFilter.connect(this.scriptProcessor);

    whiteNoise.start(0);
  },

  createWhiteNoiseNode: function (frameCount) {
    var myArrayBuffer = this.audioContext.createBuffer(
      1,
      frameCount,
      sampleRate
    );

    var nowBuffering = myArrayBuffer.getChannelData(0);
    for (var i = 0; i < frameCount; i++) {
      nowBuffering[i] = Math.random(); // gaussian();
    }

    var source = this.audioContext.createBufferSource();
    source.buffer = myArrayBuffer;
    source.loop = true;

    return source;
  },

  doScriptProcessor: function (event) {
    var inputArray1 = event.inputBuffer.getChannelData(0);
    var inputArray2 = event.inputBuffer.getChannelData(1);
    var outArray = event.outputBuffer.getChannelData(0);
    for (var j = 0, N = outArray.length; j < N; j++) {
      var lambda1 = j / N;
      var lambda2 = (j + 0.5) / N;
      var glottalOutput = Glottis.runStep(lambda1, inputArray1[j]);

      var vocalOutput = 0;
      //Tract runs at twice the sample rate
      Tract.runStep(glottalOutput, inputArray2[j], lambda1);
      vocalOutput += Tract.lipOutput + Tract.noseOutput;
      Tract.runStep(glottalOutput, inputArray2[j], lambda2);
      vocalOutput += Tract.lipOutput + Tract.noseOutput;
      outArray[j] = vocalOutput * 0.125;
    }
    Glottis.finishBlock();
    Tract.finishBlock();
  },

  mute: function () {
    this.scriptProcessor.disconnect();
  },

  unmute: function () {
    this.scriptProcessor.connect(this.audioContext.destination);
  },
};


var Tract = {
  n: 44,
  bladeStart: 10,
  tipStart: 32,
  lipStart: 39,
  R: [], //component going right
  L: [], //component going left
  reflection: [],
  junctionOutputR: [],
  junctionOutputL: [],
  maxAmplitude: [],
  diameter: [],
  restDiameter: [],
  targetDiameter: [],
  newDiameter: [],
  A: [],
  glottalReflection: 0.75,
  lipReflection: -0.85,
  lastObstruction: -1,
  fade: 1.0, //0.9999,
  movementSpeed: 15, //cm per second
  transients: [],
  lipOutput: 0,
  noseOutput: 0,
  velumTarget: 0.01,

  init: function () {
    this.bladeStart = Math.floor((this.bladeStart * this.n) / 44);
    this.tipStart = Math.floor((this.tipStart * this.n) / 44);
    this.lipStart = Math.floor((this.lipStart * this.n) / 44);
    this.diameter = new Float64Array(this.n);
    this.restDiameter = new Float64Array(this.n);
    this.targetDiameter = new Float64Array(this.n);
    this.newDiameter = new Float64Array(this.n);
    for (var i = 0; i < this.n; i++) {
      var diameter = 0;
      if (i < (7 * this.n) / 44 - 0.5) diameter = 0.6;
      else if (i < (12 * this.n) / 44) diameter = 1.1;
      else diameter = 1.5;
      this.diameter[i] =
        this.restDiameter[i] =
        this.targetDiameter[i] =
        this.newDiameter[i] =
          diameter;
    }
    this.R = new Float64Array(this.n);
    this.L = new Float64Array(this.n);
    this.reflection = new Float64Array(this.n + 1);
    this.newReflection = new Float64Array(this.n + 1);
    this.junctionOutputR = new Float64Array(this.n + 1);
    this.junctionOutputL = new Float64Array(this.n + 1);
    this.A = new Float64Array(this.n);
    this.maxAmplitude = new Float64Array(this.n);

    this.noseLength = Math.floor((28 * this.n) / 44);
    this.noseStart = this.n - this.noseLength + 1;
    this.noseR = new Float64Array(this.noseLength);
    this.noseL = new Float64Array(this.noseLength);
    this.noseJunctionOutputR = new Float64Array(this.noseLength + 1);
    this.noseJunctionOutputL = new Float64Array(this.noseLength + 1);
    this.noseReflection = new Float64Array(this.noseLength + 1);
    this.noseDiameter = new Float64Array(this.noseLength);
    this.noseA = new Float64Array(this.noseLength);
    this.noseMaxAmplitude = new Float64Array(this.noseLength);
    for (var i = 0; i < this.noseLength; i++) {
      var diameter;
      var d = 2 * (i / this.noseLength);
      if (d < 1) diameter = 0.4 + 1.6 * d;
      else diameter = 0.5 + 1.5 * (2 - d);
      diameter = Math.min(diameter, 1.9);
      this.noseDiameter[i] = diameter;
    }
    this.newReflectionLeft =
      this.newReflectionRight =
      this.newReflectionNose =
        0;
    this.calculateReflections();
    this.calculateNoseReflections();
    this.noseDiameter[0] = this.velumTarget;
  },

  reshapeTract: function (deltaTime) {
    var amount = deltaTime * this.movementSpeed;
    var newLastObstruction = -1;
    for (var i = 0; i < this.n; i++) {
      var diameter = this.diameter[i];
      var targetDiameter = this.targetDiameter[i];
      if (diameter <= 0) newLastObstruction = i;
      var slowReturn;
      if (i < this.noseStart) slowReturn = 0.6;
      else if (i >= this.tipStart) slowReturn = 1.0;
      else
        slowReturn =
          0.6 + (0.4 * (i - this.noseStart)) / (this.tipStart - this.noseStart);
      this.diameter[i] = Math.moveTowards(
        diameter,
        targetDiameter,
        slowReturn * amount,
        2 * amount
      );
    }
    if (
      this.lastObstruction > -1 &&
      newLastObstruction == -1 &&
      this.noseA[0] < 0.05
    ) {
      this.addTransient(this.lastObstruction);
    }
    this.lastObstruction = newLastObstruction;

    amount = deltaTime * this.movementSpeed;
    this.noseDiameter[0] = Math.moveTowards(
      this.noseDiameter[0],
      this.velumTarget,
      amount * 0.25,
      amount * 0.1
    );
    this.noseA[0] = this.noseDiameter[0] * this.noseDiameter[0];
  },

  calculateReflections: function () {
    for (var i = 0; i < this.n; i++) {
      this.A[i] = this.diameter[i] * this.diameter[i]; //ignoring PI etc.
    }
    for (var i = 1; i < this.n; i++) {
      this.reflection[i] = this.newReflection[i];
      if (this.A[i] == 0)
        this.newReflection[i] = 0.999; //to prevent some bad behaviour if 0
      else
        this.newReflection[i] =
          (this.A[i - 1] - this.A[i]) / (this.A[i - 1] + this.A[i]);
    }

    //now at junction with nose

    this.reflectionLeft = this.newReflectionLeft;
    this.reflectionRight = this.newReflectionRight;
    this.reflectionNose = this.newReflectionNose;
    var sum =
      this.A[this.noseStart] + this.A[this.noseStart + 1] + this.noseA[0];
    this.newReflectionLeft = (2 * this.A[this.noseStart] - sum) / sum;
    this.newReflectionRight = (2 * this.A[this.noseStart + 1] - sum) / sum;
    this.newReflectionNose = (2 * this.noseA[0] - sum) / sum;
  },

  calculateNoseReflections: function () {
    for (var i = 0; i < this.noseLength; i++) {
      this.noseA[i] = this.noseDiameter[i] * this.noseDiameter[i];
    }
    for (var i = 1; i < this.noseLength; i++) {
      this.noseReflection[i] =
        (this.noseA[i - 1] - this.noseA[i]) /
        (this.noseA[i - 1] + this.noseA[i]);
    }
  },

  runStep: function (glottalOutput, turbulenceNoise, lambda) {
    var updateAmplitudes = Math.random() < 0.1;

    //mouth
    this.processTransients();

    this.junctionOutputR[0] =
      this.L[0] * this.glottalReflection + glottalOutput;
    this.junctionOutputL[this.n] = this.R[this.n - 1] * this.lipReflection;

    for (var i = 1; i < this.n; i++) {
      var r =
        this.reflection[i] * (1 - lambda) + this.newReflection[i] * lambda;
      var w = r * (this.R[i - 1] + this.L[i]);
      this.junctionOutputR[i] = this.R[i - 1] - w;
      this.junctionOutputL[i] = this.L[i] + w;
    }

    //now at junction with nose
    var i = this.noseStart;
    var r =
      this.newReflectionLeft * (1 - lambda) + this.reflectionLeft * lambda;
    this.junctionOutputL[i] =
      r * this.R[i - 1] + (1 + r) * (this.noseL[0] + this.L[i]);
    r = this.newReflectionRight * (1 - lambda) + this.reflectionRight * lambda;
    this.junctionOutputR[i] =
      r * this.L[i] + (1 + r) * (this.R[i - 1] + this.noseL[0]);
    r = this.newReflectionNose * (1 - lambda) + this.reflectionNose * lambda;
    this.noseJunctionOutputR[0] =
      r * this.noseL[0] + (1 + r) * (this.L[i] + this.R[i - 1]);

    for (var i = 0; i < this.n; i++) {
      this.R[i] = this.junctionOutputR[i] * 0.999;
      this.L[i] = this.junctionOutputL[i + 1] * 0.999;

      //this.R[i] = Math.clamp(this.junctionOutputR[i] * this.fade, -1, 1);
      //this.L[i] = Math.clamp(this.junctionOutputL[i+1] * this.fade, -1, 1);

      if (updateAmplitudes) {
        var amplitude = Math.abs(this.R[i] + this.L[i]);
        if (amplitude > this.maxAmplitude[i]) this.maxAmplitude[i] = amplitude;
        else this.maxAmplitude[i] *= 0.999;
      }
    }

    this.lipOutput = this.R[this.n - 1];

    //nose
    this.noseJunctionOutputL[this.noseLength] =
      this.noseR[this.noseLength - 1] * this.lipReflection;

    for (var i = 1; i < this.noseLength; i++) {
      var w = this.noseReflection[i] * (this.noseR[i - 1] + this.noseL[i]);
      this.noseJunctionOutputR[i] = this.noseR[i - 1] - w;
      this.noseJunctionOutputL[i] = this.noseL[i] + w;
    }

    for (var i = 0; i < this.noseLength; i++) {
      this.noseR[i] = this.noseJunctionOutputR[i] * this.fade;
      this.noseL[i] = this.noseJunctionOutputL[i + 1] * this.fade;

      //this.noseR[i] = Math.clamp(this.noseJunctionOutputR[i] * this.fade, -1, 1);
      //this.noseL[i] = Math.clamp(this.noseJunctionOutputL[i+1] * this.fade, -1, 1);

      if (updateAmplitudes) {
        var amplitude = Math.abs(this.noseR[i] + this.noseL[i]);
        if (amplitude > this.noseMaxAmplitude[i])
          this.noseMaxAmplitude[i] = amplitude;
        else this.noseMaxAmplitude[i] *= 0.999;
      }
    }

    this.noseOutput = this.noseR[this.noseLength - 1];
  },

  finishBlock: function () {
    this.reshapeTract(AudioSystem.blockTime);
    this.calculateReflections();
  },

  addTransient: function (position) {
    var trans = {};
    trans.position = position;
    trans.timeAlive = 0;
    trans.lifeTime = 0.2;
    trans.strength = 0.3;
    trans.exponent = 200;
    this.transients.push(trans);
  },

  processTransients: function () {
    for (var i = 0; i < this.transients.length; i++) {
      var trans = this.transients[i];
      var amplitude =
        trans.strength * Math.pow(2, -trans.exponent * trans.timeAlive);
      this.R[trans.position] += amplitude / 2;
      this.L[trans.position] += amplitude / 2;
      trans.timeAlive += 1.0 / (sampleRate * 2);
    }
    for (var i = this.transients.length - 1; i >= 0; i--) {
      var trans = this.transients[i];
      if (trans.timeAlive > trans.lifeTime) {
        this.transients.splice(i, 1);
      }
    }
  },
};

var TractUI = {
  originX: 340,
  originY: 449,
  radius: 298,
  scale: 60,
  tongueIndex: 12.9,
  tongueDiameter: 2.43,
  innerTongueControlRadius: 2.05,
  outerTongueControlRadius: 3.5,
  tongueTouch: 0,
  angleScale: 0.64,
  angleOffset: -0.24,
  noseOffset: 0.8,
  gridOffset: 1.7,
  fillColour: "pink",
  lineColour: "#C070C6",

  init: function () {
    const canvas = document.getElementById("tractCanvas");
    this.ctx = canvas.getContext("2d");
    this.setRestDiameter();
    for (var i = 0; i < Tract.n; i++) {
      Tract.diameter[i] = Tract.targetDiameter[i] = Tract.restDiameter[i];
    }
    this.tongueLowerIndexBound = Tract.bladeStart + 2;
    this.tongueUpperIndexBound = Tract.tipStart - 3;
    this.tongueIndexCentre =
      0.5 * (this.tongueLowerIndexBound + this.tongueUpperIndexBound);
  },

  moveTo: function (i, d) {
    var angle =
      this.angleOffset + (i * this.angleScale * Math.PI) / (Tract.lipStart - 1);
    var wobble =
      Tract.maxAmplitude[Tract.n - 1] +
      Tract.noseMaxAmplitude[Tract.noseLength - 1];
    wobble *= (0.03 * Math.sin(2 * i - 50 * time) * i) / Tract.n;
    angle += wobble;
    var r = this.radius - this.scale * d + 100 * wobble;
    this.ctx.moveTo(
      this.originX - r * Math.cos(angle),
      this.originY - r * Math.sin(angle)
    );
  },

  lineTo: function (i, d) {
    var angle =
      this.angleOffset + (i * this.angleScale * Math.PI) / (Tract.lipStart - 1);
    var wobble =
      Tract.maxAmplitude[Tract.n - 1] +
      Tract.noseMaxAmplitude[Tract.noseLength - 1];
    wobble *= (0.03 * Math.sin(2 * i - 50 * time) * i) / Tract.n;
    angle += wobble;
    var r = this.radius - this.scale * d + 100 * wobble;
    this.ctx.lineTo(
      this.originX - r * Math.cos(angle),
      this.originY - r * Math.sin(angle)
    );
  },

  getIndex: function (x, y) {
    var xx = x - this.originX;
    var yy = y - this.originY;
    var angle = Math.atan2(yy, xx);
    while (angle > 0) angle -= 2 * Math.PI;
    return (
      ((Math.PI + angle - this.angleOffset) * (Tract.lipStart - 1)) /
      (this.angleScale * Math.PI)
    );
  },
  getDiameter: function (x, y) {
    var xx = x - this.originX;
    var yy = y - this.originY;
    return (this.radius - Math.sqrt(xx * xx + yy * yy)) / this.scale;
  },

  draw: function () {
    this.ctx.clearRect(0, 0, tractCanvas.width, tractCanvas.height);
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    this.drawTongueControl();
    this.drawPitchControl();

    var velum = Tract.noseDiameter[0];
    var velumAngle = velum * 4;

    //then draw lines
    this.ctx.beginPath();
    this.ctx.lineWidth = 5;
    this.ctx.strokeStyle = this.lineColour;
    this.ctx.lineJoin = "round";
    this.ctx.lineCap = "round";
    this.moveTo(1, Tract.diameter[0]);
    for (var i = 2; i < Tract.n; i++) this.lineTo(i, Tract.diameter[i]);
    this.moveTo(1, 0);
    for (var i = 2; i <= Tract.noseStart - 2; i++) this.lineTo(i, 0);
    this.moveTo(Tract.noseStart + velumAngle - 2, 0);
    for (var i = Tract.noseStart + Math.ceil(velumAngle) - 2; i < Tract.n; i++)
      this.lineTo(i, 0);
    this.ctx.stroke();

    //for nose
    this.ctx.beginPath();
    this.ctx.lineWidth = 5;
    this.ctx.strokeStyle = this.lineColour;
    this.ctx.lineJoin = "round";
    this.moveTo(Tract.noseStart, -this.noseOffset);
    for (var i = 1; i < Tract.noseLength; i++)
      this.lineTo(
        i + Tract.noseStart,
        -this.noseOffset - Tract.noseDiameter[i] * 0.9
      );
    this.moveTo(Tract.noseStart + velumAngle, -this.noseOffset);
    for (var i = Math.ceil(velumAngle); i < Tract.noseLength; i++)
      this.lineTo(i + Tract.noseStart, -this.noseOffset);
    this.ctx.stroke();

    //velum
    this.ctx.globalAlpha = velum * 5;
    this.ctx.beginPath();
    this.moveTo(Tract.noseStart - 2, 0);
    this.lineTo(Tract.noseStart, -this.noseOffset);
    this.moveTo(Tract.noseStart + velumAngle - 2, 0);
    this.lineTo(Tract.noseStart + velumAngle, -this.noseOffset);
    this.ctx.stroke();

  },

  drawTongueControl: function () {
    //circle for tongue position
    var angle =
      this.angleOffset +
      (this.tongueIndex * this.angleScale * Math.PI) / (Tract.lipStart - 1);
    var r = this.radius - this.scale * this.tongueDiameter;
    var x = this.originX - r * Math.cos(angle);
    var y = this.originY - r * Math.sin(angle);

    this.ctx.globalAlpha = 1.0;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 18, 0, 2 * Math.PI);
    this.ctx.fill();
  },

  drawPitchControl: function () {
    if (Glottis.x) {
      this.ctx.beginPath();
      this.ctx.arc(Glottis.x, Glottis.y, 3, 0, 2 * Math.PI);
      this.ctx.fill();
    }
  },

  setRestDiameter: function () {
    for (var i = Tract.bladeStart; i < Tract.lipStart; i++) {
      var t =
        (1.1 * Math.PI * (this.tongueIndex - i)) /
        (Tract.tipStart - Tract.bladeStart);
      var fixedTongueDiameter = 2 + (this.tongueDiameter - 2) / 1.5;
      var curve = (1.5 - fixedTongueDiameter + this.gridOffset) * Math.cos(t);
      if (i == Tract.bladeStart - 2 || i == Tract.lipStart - 1) curve *= 0.8;
      if (i == Tract.bladeStart || i == Tract.lipStart - 2) curve *= 0.94;
      Tract.restDiameter[i] = 1.5 - curve;
    }
  },

  handleTouches: function () {
    if (this.tongueTouch != 0 && !this.tongueTouch.alive) this.tongueTouch = 0;

    if (this.tongueTouch == 0) {
      for (var j = 0; j < UI.touchesWithMouse.length; j++) {
        var touch = UI.touchesWithMouse[j];
        if (!touch.alive) continue;
        //if (touch.fricative_intensity == 1) continue; //only new touches will pass this
        var x = touch.x;
        var y = touch.y;
        var index = TractUI.getIndex(x, y);
        var diameter = TractUI.getDiameter(x, y);
        if (
          index >= this.tongueLowerIndexBound - 4 &&
          index <= this.tongueUpperIndexBound + 4 &&
          diameter >= this.innerTongueControlRadius - 0.5 &&
          diameter <= this.outerTongueControlRadius + 0.5
        ) {
          this.tongueTouch = touch;
        }
      }
    }

    if (this.tongueTouch != 0) {
      var x = this.tongueTouch.x;
      var y = this.tongueTouch.y;
      var index = TractUI.getIndex(x, y);
      var diameter = TractUI.getDiameter(x, y);
      var fromPoint =
        (this.outerTongueControlRadius - diameter) /
        (this.outerTongueControlRadius - this.innerTongueControlRadius);
      fromPoint = Math.clamp(fromPoint, 0, 1);
      fromPoint =
        Math.pow(fromPoint, 0.58) - 0.2 * (fromPoint * fromPoint - fromPoint); //horrible kludge to fit curve to straight line
      this.tongueDiameter = Math.clamp(
        diameter,
        this.innerTongueControlRadius,
        this.outerTongueControlRadius
      );
      //this.tongueIndex = Math.clamp(index, this.tongueLowerIndexBound, this.tongueUpperIndexBound);
      var out =
        fromPoint *
        0.5 *
        (this.tongueUpperIndexBound - this.tongueLowerIndexBound);
      this.tongueIndex = Math.clamp(
        index,
        this.tongueIndexCentre - out,
        this.tongueIndexCentre + out
      );
    }

    this.setRestDiameter();
    for (var i = 0; i < Tract.n; i++)
      Tract.targetDiameter[i] = Tract.restDiameter[i];

    //other constrictions and nose
    Tract.velumTarget = 0.01;
    for (var j = 0; j < UI.touchesWithMouse.length; j++) {
      var touch = UI.touchesWithMouse[j];
      if (!touch.alive) continue;
      var x = touch.x;
      var y = touch.y;
      var index = TractUI.getIndex(x, y);
      var diameter = TractUI.getDiameter(x, y);
      if (index > Tract.noseStart && diameter < -this.noseOffset) {
        Tract.velumTarget = 0.4;
      }
      if (diameter < -0.85 - this.noseOffset) continue;
      diameter -= 0.3;
      if (diameter < 0) diameter = 0;
      var width = 2;
      if (index < 25) width = 10;
      else if (index >= Tract.tipStart) width = 5;
      else width = 10 - (5 * (index - 25)) / (Tract.tipStart - 25);
      if (
        index >= 2 &&
        index < Tract.n &&
        y < tractCanvas.height &&
        diameter < 3
      ) {
        var intIndex = Math.round(index);
        for (var i = -Math.ceil(width) - 1; i < width + 1; i++) {
          if (intIndex + i < 0 || intIndex + i >= Tract.n) continue;
          var relpos = intIndex + i - index;
          relpos = Math.abs(relpos) - 0.5;
          var shrink;
          if (relpos <= 0) shrink = 0;
          else if (relpos > width) shrink = 1;
          else shrink = 0.5 * (1 - Math.cos((Math.PI * relpos) / width));
          if (diameter < Tract.targetDiameter[intIndex + i]) {
            Tract.targetDiameter[intIndex + i] =
              diameter +
              (Tract.targetDiameter[intIndex + i] - diameter) * shrink;
          }
        }
      }
    }
  },
};

document.body.style.cursor = "pointer";

AudioSystem.init();

GlottisUI.init();
Glottis.init(GlottisUI, sampleRate);
Tract.init();
TractUI.init();
UI.init(time, TractUI, function(){
  if (!AudioSystem.started) {
    AudioSystem.started = true;
    AudioSystem.startSound();
  }
});

requestAnimationFrame(redraw);
function redraw() {
  Glottis.update();
  TractUI.draw();
  requestAnimationFrame(redraw);
  time = Date.now() / 1000;
}
