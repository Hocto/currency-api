module.exports = function isNumber(n) {
  return /^-?[\d.]+(?:e-?\d+)?$/.test(n);
};
