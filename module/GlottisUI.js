

export const GlottisUI = {
  init(){
    this.elem = {
      alwaysVoice : document.querySelector('[name="alwaysVoice"]'),
      autoWobble : document.querySelector('[name="autoWobble"]'),
      loudness : document.querySelector('[name="loudness"]'),
      frequency : document.querySelector('[name="frequency"]')
    };
  },
  get(){
    return {
      alwaysVoice : this.elem.alwaysVoice.checked,
      autoWobble : this.elem.autoWobble.checked,
      loudness : this.elem.loudness.value,
      frequency : this.elem.frequency.value,
    }
  }

}