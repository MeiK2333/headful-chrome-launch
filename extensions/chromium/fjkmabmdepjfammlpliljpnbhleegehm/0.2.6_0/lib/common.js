app.update = function () {
  var state = config.addon.state;
  var iconpath = '../../data/icons/' + (state ? state + '/' : '');
  app.button.icon = {
    "path": {
      '16': iconpath + '16.png',
      '32': iconpath + '32.png',
      '48': iconpath + '48.png',
      '64': iconpath + '64.png'
    }
  };
  /*  */
  app.webRTC();
  app.button.label = "WebRTC leak protection is " + (state === "enabled" ? "ON" : "OFF");
};

app.addon.receive("options:inject", function (e) {
  config.addon.inject = e.inject;
  /*  */
  app.update();
});

app.addon.receive("options:devices", function (e) {
  config.addon.devices = e.devices;
  /*  */
  app.update();
});

app.addon.receive("options:webrtc", function (e) {
  config.addon.webrtc = e.webrtc;
  config.addon.state = config.addon.webrtc === "default" ? "disabled" : "enabled";
  /*  */
  app.update();
});

app.button.onCommand(function () {
  var state = config.addon.state;
  config.addon.state = state === "disabled" ? "enabled" : "disabled";
  config.addon.state = config.addon.webrtc === "default" ? "disabled" : config.addon.state;
  /*  */
  app.update();
});

app.addon.receive("page:load", function (e) {
  app.addon.send("page:storage", {
    "state": config.addon.state,
    "inject": config.addon.inject,
    "devices": config.addon.devices
  }, e ? e.tabId : '');
});

app.addon.receive("options:load", function () {
  app.addon.send("options:storage", {
    "webrtc": config.addon.webrtc,
    "inject": config.addon.inject,
    "devices": config.addon.devices
  });
});

app.contextmenu.create();
window.setTimeout(app.update, 0);
app.contextmenu.clicked(function () {app.tab.open(config.webrtc.test.page)});
app.addon.receive("options:support", function () {app.tab.open(app.homepage())});
app.addon.receive("options:test", function () {app.tab.open(config.webrtc.test.page)});
app.addon.receive("options:donation", function () {app.tab.open(app.homepage() + "?reason=support")});
