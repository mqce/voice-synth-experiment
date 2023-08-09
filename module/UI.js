let touch = {
  alive: false,
};
let TractUI;

export const UI = {
  tractUI: null,
  onStartMouse: null,

  init(tractUI, onStartMouse) {
    TractUI = tractUI;
    this.onStartMouse = onStartMouse;

    const container = document.querySelector('canvas');
    container.addEventListener("mousedown", e => {
      e.preventDefault();
      UI.startMouse(e);
    });
    container.addEventListener("mousemove", e=> {
      UI.moveMouse(e);
    });
    container.addEventListener("mouseup", e=> {
      UI.endMouse();
    });
  },

  startMouse(event) {
    this.onStartMouse.call();
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