module.exports = (x) => {
    return x.toString().match(/^-?\d+(?:\.\d{0,3})?/)[0];
}