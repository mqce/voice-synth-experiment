let time = 0;

export const UI = {
  width: 600,
  tractUI: null,
  onStartMouse: null,

  init: function (t, tractUI, onStartMouse) {
    time = t;
    this.tractUI = tractUI;
    this.onStartMouse = onStartMouse;
    this.touchesWithMouse = [];
    this.mouseTouch = { alive: false, endTime: 0 };
    this.mouseDown = false;

    const container = document.querySelector('canvas');
    container.addEventListener("mousedown", function (event) {
      UI.mouseDown = true;
      event.preventDefault();
      UI.startMouse(event);
    });
    container.addEventListener("mouseup", function (event) {
      UI.mouseDown = false;
      UI.endMouse(event);
    });
    container.addEventListener("mousemove", (e)=>{
      UI.moveMouse(e);
    });
  },

  startMouse: function (event) {
    this.onStartMouse.call();

    var touch = {};
    touch.startTime = time;
    touch.fricative_intensity = 0;
    touch.endTime = 0;
    touch.alive = true;
    touch.id = "mouse" + Math.random();
    touch.x = ((event.pageX - tractCanvas.offsetLeft) / UI.width) * 600;
    touch.y = ((event.pageY - tractCanvas.offsetTop) / UI.width) * 600;
    touch.index = this.tractUI.getIndex(touch.x, touch.y);
    touch.diameter = this.tractUI.getDiameter(touch.x, touch.y);
    UI.mouseTouch = touch;
    UI.touchesWithMouse.push(touch);
    UI.handleTouches();
  },

  moveMouse: function (event) {
    var touch = UI.mouseTouch;
    if (!touch.alive) return;
    touch.x = ((event.pageX - tractCanvas.offsetLeft) / UI.width) * 600;
    touch.y = ((event.pageY - tractCanvas.offsetTop) / UI.width) * 600;
    touch.index = this.tractUI.getIndex(touch.x, touch.y);
    touch.diameter = this.tractUI.getDiameter(touch.x, touch.y);
    UI.handleTouches();
  },

  endMouse: function (event) {
    var touch = UI.mouseTouch;
    if (!touch.alive) return;
    touch.alive = false;
    touch.endTime = time;
    UI.handleTouches();
  },

  handleTouches: function (event) {
    this.tractUI.handleTouches();
  },

  updateTouches: function () {
    var fricativeAttackTime = 0.1;
    for (var j = UI.touchesWithMouse.length - 1; j >= 0; j--) {
      var touch = UI.touchesWithMouse[j];
      if (!touch.alive && time > touch.endTime + 1) {
        UI.touchesWithMouse.splice(j, 1);
      } else if (touch.alive) {
        touch.fricative_intensity = Math.clamp(
          (time - touch.startTime) / fricativeAttackTime,
          0,
          1
        );
      } else {
        touch.fricative_intensity = Math.clamp(
          1 - (time - touch.endTime) / fricativeAttackTime,
          0,
          1
        );
      }
    }
  },
};