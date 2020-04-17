var load = function () {
  var test = document.querySelector("#test");
  var inject = document.querySelector("#inject");
  var select = document.querySelector("#method");
  var support = document.querySelector("#support");
  var devices = document.querySelector("#devices");
  var donation = document.querySelector("#donation");
  /*  */
  test.addEventListener("click", function (e) {background.send("options:test")});
  support.addEventListener("click", function (e) {background.send("options:support")});
  donation.addEventListener("click", function (e) {background.send("options:donation")});
  select.addEventListener("change", function (e) {background.send("options:webrtc", {"webrtc": e.target.value})});
  inject.addEventListener("change", function (e) {background.send("options:inject", {"inject": e.target.checked})});
  devices.addEventListener("change", function (e) {background.send("options:devices", {"devices": e.target.checked})});
  /*  */
  background.send("options:load");
  window.removeEventListener("load", load, false);
};

background.receive("options:storage", function (e) {
  var inject = document.querySelector("#inject");
  var devices = document.querySelector("#devices");
  var select = document.querySelector("#method");
  /*  */
  if (e.webrtc) select.value = e.webrtc;
  if (e.inject) inject.checked = e.inject;
  if (e.devices) devices.checked = e.devices;
});

window.addEventListener("load", load, false);
