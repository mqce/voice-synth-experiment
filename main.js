import "./style.css";
import "./module/math.js";

import { AudioSystem } from "./module/AudioSystem.js";
import { UI } from "./module/UI.js";
import { GlottisUI } from "./module/GlottisUI.js";
import { Glottis } from "./module/Glottis.js";
import { Tract } from "./module/Tract.js";
import { TractUI } from "./module/TractUI.js";

var time = 0;

const sampleRate = AudioSystem.init(Glottis, Tract);
GlottisUI.init();
Glottis.init(GlottisUI, sampleRate);
Tract.init(sampleRate);
TractUI.init(time, UI, Glottis, Tract);
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
