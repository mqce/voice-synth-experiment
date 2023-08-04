Number.prototype.clamp = function(min, max) {
  return Math.min(Math.max(this, min), max);
};

Math.clamp = function (number, min, max) {
  if (number < min) return min;
  else if (number > max) return max;
  else return number;
};

Math.moveTowards = function (current, target, amountUp, amountDown) {
  if (current < target) return Math.min(current + amountUp, target);
  else return Math.max(current - amountDown, target);
};