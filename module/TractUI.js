let Tract;

const originX = 340;
const originY = 449;

let touch = {
  alive: false,
};

const UI = {
  init(canvas) {
    canvas.addEventListener("mousedown", e => {
      e.preventDefault();
      this.startMouse(e);
    });
    canvas.addEventListener("mousemove", e=> {
      this.moveMouse(e);
    });
    canvas.addEventListener("mouseup", e=> {
      this.endMouse();
    });
  },

  startMouse(event) {
    touch.alive = true;
    touch.x = event.clientX;
    touch.y = event.clientY;
    TractUI.handleTouches(touch);
  },

  moveMouse(event) {
    if (!touch.alive) return;
    touch.x = event.clientX;
    touch.y = event.clientY;
    TractUI.handleTouches(touch);
  },

  endMouse() {
    if (!touch.alive) return;
    touch.alive = false;
    TractUI.handleTouches(touch);
  },

};

export const TractUI = {
  bladeStart: 10,
  lipStart: 39,

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
  lineColour: "#eee",

  init(tract) {
    Tract = tract;
    const canvas = document.getElementById("tractCanvas");
    this.ctx = canvas.getContext("2d");
    UI.init(canvas);
    this.setRestDiameter();
    for (var i = 0; i < Tract.n; i++) {
      Tract.diameter[i] = Tract.targetDiameter[i] = Tract.restDiameter[i];
    }
    this.tongueLowerIndexBound = this.bladeStart + 2;
    this.tongueUpperIndexBound = Tract.tipStart - 3;
    this.tongueIndexCentre =
      0.5 * (this.tongueLowerIndexBound + this.tongueUpperIndexBound);
  },

  moveTo: function (i, d) {
    const time = Date.now() / 1000;
    var angle =
      this.angleOffset + (i * this.angleScale * Math.PI) / (this.lipStart - 1);
    var wobble =
      Tract.maxAmplitude[Tract.n - 1] +
      Tract.noseMaxAmplitude[Tract.noseLength - 1];
    wobble *= (0.03 * Math.sin(2 * i - 50 * time) * i) / Tract.n;
    angle += wobble;
    var r = this.radius - this.scale * d + 100 * wobble;
    this.ctx.moveTo(
      originX - r * Math.cos(angle),
      originY - r * Math.sin(angle)
    );
  },

  lineTo: function (i, d) {
    const time = Date.now() / 1000;
    var angle =
      this.angleOffset + (i * this.angleScale * Math.PI) / (this.lipStart - 1);
    var wobble =
      Tract.maxAmplitude[Tract.n - 1] +
      Tract.noseMaxAmplitude[Tract.noseLength - 1];
    wobble *= (0.03 * Math.sin(2 * i - 50 * time) * i) / Tract.n;
    angle += wobble;
    var r = this.radius - this.scale * d + 100 * wobble;
    this.ctx.lineTo(
      originX - r * Math.cos(angle),
      originY - r * Math.sin(angle)
    );
  },

  getIndex: function (x, y) {
    var xx = x - originX;
    var yy = y - originY;
    var angle = Math.atan2(yy, xx);
    while (angle > 0) angle -= 2 * Math.PI;
    return (
      ((Math.PI + angle - this.angleOffset) * (this.lipStart - 1)) /
      (this.angleScale * Math.PI)
    );
  },
  getDiameter: function (x, y) {
    var xx = x - originX;
    var yy = y - originY;
    return (this.radius - Math.sqrt(xx * xx + yy * yy)) / this.scale;
  },

  update: function () {
    this.ctx.clearRect(0, 0, tractCanvas.width, tractCanvas.height);
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    this.drawTongueControl();

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
      (this.tongueIndex * this.angleScale * Math.PI) / (this.lipStart - 1);
    var r = this.radius - this.scale * this.tongueDiameter;
    var x = originX - r * Math.cos(angle);
    var y = originY - r * Math.sin(angle);

    this.ctx.globalAlpha = 1.0;
    this.ctx.beginPath();
    this.ctx.arc(x, y, 18, 0, 2 * Math.PI);
    this.ctx.fill();
  },

  setRestDiameter: function () {
    for (var i = this.bladeStart; i < this.lipStart; i++) {
      var t =
        (1.1 * Math.PI * (this.tongueIndex - i)) /
        (Tract.tipStart - this.bladeStart);
      var fixedTongueDiameter = 2 + (this.tongueDiameter - 2) / 1.5;
      var curve = (1.5 - fixedTongueDiameter + this.gridOffset) * Math.cos(t);
      if (i == this.bladeStart - 2 || i == this.lipStart - 1) curve *= 0.8;
      if (i == this.bladeStart || i == this.lipStart - 2) curve *= 0.94;
      Tract.restDiameter[i] = 1.5 - curve;
    }
  },

  handleTouches: function (touch) {
    if (this.tongueTouch != 0 && !this.tongueTouch.alive) this.tongueTouch = 0;

    if (this.tongueTouch == 0) {
      if (touch.alive) {
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

    if (touch.alive) {
      var x = touch.x;
      var y = touch.y;
      var index = TractUI.getIndex(x, y);
      var diameter = TractUI.getDiameter(x, y);
      if (index > Tract.noseStart && diameter < -this.noseOffset) {
        Tract.velumTarget = 0.4;
      }
      if (diameter >= -0.85 - this.noseOffset) {
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
      
    }
  },
};
