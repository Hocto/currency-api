const moesif = require("moesif-nodejs");

module.exports = moesif({
  applicationId:
    "eyJhcHAiOiIyODU6MjMzIiwidmVyIjoiMi4wIiwib3JnIjoiOTk1OjE5NSIsImlhdCI6MTYzNTcyNDgwMH0.kNxhlHkoO54xMFX7aZvtcIul-zx5fm2hFd9esT6gL6U",

  identifyUser: function (req, res) {
    return req.user ? req.user.id : undefined;
  },
});
