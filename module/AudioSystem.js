var sampleRate,glottis,tract;

export const AudioSystem = {
  blockLength: 512,
  blockTime: 1,
  started: false,

  init: function (_glottis, _tract) {
    glottis = _glottis;
    tract = _tract;
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new window.AudioContext();
    sampleRate = this.audioContext.sampleRate;
    this.blockTime = this.blockLength / sampleRate;

    return sampleRate;
  },

  start(){
    if (!this.started) {
      this.started = true;
      this.startSound();
    }
  },

  startSound: function () {
    //scriptProcessor may need a dummy input channel on iOS
    this.scriptProcessor = this.audioContext.createScriptProcessor(
      this.blockLength,
      2,
      1
    );
    this.scriptProcessor.connect(this.audioContext.destination);
    this.scriptProcessor.onaudioprocess = this.doScriptProcessor;

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

  doScriptProcessor(event){
    var inputArray = event.inputBuffer.getChannelData(0);
    var outArray = event.outputBuffer.getChannelData(0);
    for (var j = 0, N = outArray.length; j < N; j++) {
      var lambda1 = j / N;
      var lambda2 = (j + 0.5) / N;
      var glottalOutput = glottis.runStep(inputArray[j], lambda1);

      var vocalOutput = 0;
      //Tract runs at twice the sample rate
      vocalOutput += tract.runStep(glottalOutput, lambda1);
      vocalOutput += tract.runStep(glottalOutput, lambda2);
      outArray[j] = vocalOutput * 0.125;
    }
    glottis.finishBlock();
    tract.finishBlock(AudioSystem.blockTime);
  },

  mute: function () {
    this.scriptProcessor.disconnect();
  },

  unmute: function () {
    this.scriptProcessor.connect(this.audioContext.destination);
  },
};
