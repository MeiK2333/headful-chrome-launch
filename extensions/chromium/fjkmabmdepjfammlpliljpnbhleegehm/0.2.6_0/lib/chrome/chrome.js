var app = {};

app.version = function () {return chrome.runtime.getManifest().version};
app.homepage = function () {return chrome.runtime.getManifest().homepage_url};
app.tab = {"open": function (url) {chrome.tabs.create({"url": url, "active": true})}};

if (!navigator.webdriver) {
  chrome.runtime.setUninstallURL(app.homepage() + "?v=" + app.version() + "&type=uninstall", function () {});
  chrome.runtime.onInstalled.addListener(function (e) {
    window.setTimeout(function () {
      var previous = e.previousVersion !== undefined && e.previousVersion !== app.version();
      var doupdate = previous && parseInt((Date.now() - config.welcome.lastupdate) / (24 * 3600 * 1000)) > 45;
      if (e.reason === "install" || (e.reason === "update" && doupdate)) {
        var parameter = (e.previousVersion ? "&p=" + e.previousVersion : '') + "&type=" + e.reason;
        app.tab.open(app.homepage() + "?v=" + app.version() + parameter);
        config.welcome.lastupdate = Date.now();
      }
    }, 3000);
  });
}

app.button = (function () {
  var onCommand;
  chrome.browserAction.onClicked.addListener(function () {if (onCommand) onCommand()});
  /*  */
  return {
    "onCommand": function (c) {onCommand = c},
    set icon (o) {chrome.browserAction.setIcon(o)},
    set label (s) {chrome.browserAction.setTitle({"title": s})}
  }
})();

app.contextmenu = (function () {
  var clicked;
  chrome.contextMenus.onClicked.addListener(function (e) {if (clicked) clicked(e)});
  /*  */
  return {
    "clicked": function (e) {clicked = e},
    "create": function () {
      chrome.contextMenus.removeAll(function () {
        chrome.contextMenus.create({
          "title": "Test WebRTC Leak",
          "contexts": ["browser_action"]
        });
      });
    }
  };
})();

app.storage = (function () {
  var objs = {};
  window.setTimeout(function () {
    chrome.storage.local.get(null, function (o) {
      objs = o;
      var script = document.createElement("script");
      script.src = "../common.js";
      document.body.appendChild(script);
    });
  }, 0);
  /*  */
  return {
    "read": function (id) {return objs[id]},
    "write": function (id, data) {
      var tmp = {};
      tmp[id] = data;
      objs[id] = data;
      chrome.storage.local.set(tmp, function () {});
    }
  }
})();

app.webRTC = function () {
  if (chrome.privacy) {
    if (chrome.privacy.network) {
      if (chrome.privacy.network.webRTCIPHandlingPolicy) {
        var IPHandlingPolicy = (config.addon.state === "enabled") ? {"value": config.addon.webrtc} : {"value": 'default'};
        chrome.privacy.network.webRTCIPHandlingPolicy.set(IPHandlingPolicy, function () {
          chrome.privacy.network.webRTCIPHandlingPolicy.get({}, function (e) {
            //console.error("IPHandlingPolicy: ", e.value);
          });
        });
      }
      /*  */
      if (chrome.privacy.network.webRTCMultipleRoutesEnabled) { // Deprecated since Chrome 48
        var MultipleRoutes = {"value": (config.addon.state === "disabled"), "scope": 'regular'};
        chrome.privacy.network.webRTCMultipleRoutesEnabled.set(MultipleRoutes, function () {
          chrome.privacy.network.webRTCMultipleRoutesEnabled.get({}, function (e) {
            //console.error("MultipleRoutes: ", e.value);
          });
        });
      }
    }
  }
};

app.addon = (function () {
  var tmp = {};
  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    for (var id in tmp) {
      if (tmp[id] && (typeof tmp[id] === "function")) {
        if (request.method === id) {
          var a = request.data || {};
          if (sender.tab) a["tabId"] = sender.tab.id;
          tmp[id](a);
        }
      }
    }
  });
  /*  */
  return {
    "receive": function (id, callback) {tmp[id] = callback},
    "send": function (id, data, tabId) {
      chrome.runtime.sendMessage({"method": id, "data": data});
      chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
          if (!tabId || (tabId && tab.id === tabId)) {
            var a = data || {};
            a["tabId"] = tab.id;
            chrome.tabs.sendMessage(tab.id, {"method": id, "data": a});
          }
        });
      });
    }
  }
})();
