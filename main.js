import "./style.css";
import "./module/math.js";

import { AudioSystem } from "./module/AudioSystem.js";
import { GlottisUI } from "./module/GlottisUI.js";
import { Glottis } from "./module/Glottis.js";
import { Tract } from "./module/Tract.js";
import { TractUI } from "./module/TractUI.js";

const sampleRate = AudioSystem.init(Glottis, Tract);
GlottisUI.init();
Glottis.init(GlottisUI, sampleRate);
Tract.init(sampleRate);
TractUI.init(Tract, () => {
  AudioSystem.start();
});

function redraw() {
  Glottis.update();
  TractUI.draw();
  requestAnimationFrame(redraw);
}
requestAnimationFrame(redraw);
