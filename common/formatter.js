module.exports = (direction) => {
  return new Intl.NumberFormat("en-US", {
    style: "decimal",
    currency: direction,
  });
};
