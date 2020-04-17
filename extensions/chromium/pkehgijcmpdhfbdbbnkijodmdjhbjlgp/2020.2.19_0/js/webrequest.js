/*
 *
 * This file is part of Privacy Badger <https://www.eff.org/privacybadger>
 * Copyright (C) 2016 Electronic Frontier Foundation
 *
 * Derived from Adblock Plus
 * Copyright (C) 2006-2013 Eyeo GmbH
 *
 * Derived from Chameleon <https://github.com/ghostwords/chameleon>
 * Copyright (C) 2015 ghostwords
 *
 * Privacy Badger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Privacy Badger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Privacy Badger.  If not, see <http://www.gnu.org/licenses/>.
 */

/* globals badger:false, log:false */

require.scopes.webrequest = (function() {

/*********************** webrequest scope **/

var constants = require("constants");
var getSurrogateURI = require("surrogates").getSurrogateURI;
var incognito = require("incognito");
var utils = require("utils");

/************ Local Variables *****************/
var temporaryWidgetUnblock = {};

/***************** Blocking Listener Functions **************/

/**
 * Event handling of http requests, main logic to collect data what to block
 *
 * @param {Object} details The event details
 * @returns {Object} Can cancel requests
 */
function onBeforeRequest(details) {
  var frame_id = details.frameId,
    tab_id = details.tabId,
    type = details.type,
    url = details.url;

  if (type == "main_frame") {
    forgetTab(tab_id);
    badger.recordFrame(tab_id, frame_id, url);
    return {};
  }

  if (type == "sub_frame") {
    badger.recordFrame(tab_id, frame_id, url);
  }

  // Block ping requests sent by navigator.sendBeacon (see, #587)
  // tabId for pings are always -1 due to Chrome bugs #522124 and #522129
  // Once these bugs are fixed, PB will treat pings as any other request
  if (type == "ping" && tab_id < 0) {
    return {cancel: true};
  }

  if (_isTabChromeInternal(tab_id)) {
    return {};
  }

  let tab_host = getHostForTab(tab_id);
  let request_host = window.extractHostFromURL(url);

  if (!utils.isThirdPartyDomain(request_host, tab_host)) {
    return {};
  }

  var requestAction = checkAction(tab_id, request_host, frame_id);
  if (!requestAction) {
    return {};
  }

  // log the third-party domain asynchronously
  // (don't block a critical code path on updating the badge)
  setTimeout(function () {
    badger.logThirdPartyOriginOnTab(tab_id, request_host, requestAction);
  }, 0);

  if (!badger.isPrivacyBadgerEnabled(tab_host)) {
    return {};
  }

  if (requestAction != constants.BLOCK && requestAction != constants.USER_BLOCK) {
    return {};
  }

  if (type == 'script') {
    var surrogate = getSurrogateURI(url, request_host);
    if (surrogate) {
      return {redirectUrl: surrogate};
    }
  }

  // Notify the content script...
  var msg = {
    replaceWidget: true,
    trackerDomain: request_host
  };
  chrome.tabs.sendMessage(tab_id, msg);

  // if this is a heuristically- (not user-) blocked domain
  if (requestAction == constants.BLOCK && incognito.learningEnabled(tab_id)) {
    // check for DNT policy asynchronously
    setTimeout(function () {
      badger.checkForDNTPolicy(request_host);
    }, 0);
  }

  if (type == 'sub_frame' && badger.getSettings().getItem('hideBlockedElements')) {
    return {
      redirectUrl: 'about:blank'
    };
  }

  return {cancel: true};
}

/**
 * Filters outgoing cookies and referer
 * Injects DNT
 *
 * @param {Object} details Event details
 * @returns {Object} modified headers
 */
function onBeforeSendHeaders(details) {
  let frame_id = details.frameId,
    tab_id = details.tabId,
    type = details.type,
    url = details.url;

  if (_isTabChromeInternal(tab_id)) {
    // DNT policy requests: strip cookies
    if (type == "xmlhttprequest" && url.endsWith("/.well-known/dnt-policy.txt")) {
      // remove Cookie headers
      let newHeaders = [];
      for (let i = 0, count = details.requestHeaders.length; i < count; i++) {
        let header = details.requestHeaders[i];
        if (header.name.toLowerCase() != "cookie") {
          newHeaders.push(header);
        }
      }
      return {
        requestHeaders: newHeaders
      };
    }

    return {};
  }

  let tab_host = getHostForTab(tab_id);
  let request_host = window.extractHostFromURL(url);

  if (!utils.isThirdPartyDomain(request_host, tab_host)) {
    if (badger.isPrivacyBadgerEnabled(tab_host)) {
      // Still sending Do Not Track even if HTTP and cookie blocking are disabled
      if (badger.isDNTSignalEnabled()) {
        details.requestHeaders.push({name: "DNT", value: "1"});
      }
      return {requestHeaders: details.requestHeaders};
    } else {
      return {};
    }
  }

  var requestAction = checkAction(tab_id, request_host, frame_id);

  if (requestAction) {
    // log the third-party domain asynchronously
    setTimeout(function () {
      badger.logThirdPartyOriginOnTab(tab_id, request_host, requestAction);
    }, 0);
  }

  if (!badger.isPrivacyBadgerEnabled(tab_host)) {
    return {};
  }

  // handle cookieblocked requests
  if (requestAction == constants.COOKIEBLOCK || requestAction == constants.USER_COOKIE_BLOCK) {
    let newHeaders;

    // GET requests: remove cookie headers, reduce referrer header to origin
    if (details.method == "GET") {
      newHeaders = details.requestHeaders.filter(header => {
        return (header.name.toLowerCase() != "cookie");
      }).map(header => {
        if (header.name.toLowerCase() == "referer") {
          header.value = header.value.slice(
            0,
            header.value.indexOf('/', header.value.indexOf('://') + 3)
          ) + '/';
        }
        return header;
      });

    // remove cookie and referrer headers otherwise
    } else {
      newHeaders = details.requestHeaders.filter(header => {
        return (header.name.toLowerCase() != "cookie" && header.name.toLowerCase() != "referer");
      });
    }

    // add DNT header
    if (badger.isDNTSignalEnabled()) {
      newHeaders.push({name: "DNT", value: "1"});
    }

    return {requestHeaders: newHeaders};
  }

  // if we are here, we're looking at a third-party request
  // that's not yet blocked or cookieblocked
  if (badger.isDNTSignalEnabled()) {
    details.requestHeaders.push({name: "DNT", value: "1"});
  }
  return {requestHeaders: details.requestHeaders};
}

/**
 * Filters incoming cookies out of the response header
 *
 * @param {Object} details The event details
 * @returns {Object} The new response headers
 */
function onHeadersReceived(details) {
  var tab_id = details.tabId,
    url = details.url;

  if (_isTabChromeInternal(tab_id)) {
    // DNT policy responses: strip cookies, reject redirects
    if (details.type == "xmlhttprequest" && url.endsWith("/.well-known/dnt-policy.txt")) {
      // if it's a redirect, cancel it
      if (details.statusCode >= 300 && details.statusCode < 400) {
        return {
          cancel: true
        };
      }

      // remove Set-Cookie headers
      let headers = details.responseHeaders,
        newHeaders = [];
      for (let i = 0, count = headers.length; i < count; i++) {
        if (headers[i].name.toLowerCase() != "set-cookie") {
          newHeaders.push(headers[i]);
        }
      }
      return {
        responseHeaders: newHeaders
      };
    }

    return {};
  }

  let tab_host = getHostForTab(tab_id);
  let request_host = window.extractHostFromURL(url);

  if (!utils.isThirdPartyDomain(request_host, tab_host)) {
    return {};
  }

  var requestAction = checkAction(tab_id, request_host, details.frameId);
  if (!requestAction) {
    return {};
  }

  // log the third-party domain asynchronously
  setTimeout(function () {
    badger.logThirdPartyOriginOnTab(tab_id, request_host, requestAction);
  }, 0);

  if (!badger.isPrivacyBadgerEnabled(tab_host)) {
    return {};
  }

  if (requestAction == constants.COOKIEBLOCK || requestAction == constants.USER_COOKIE_BLOCK) {
    var newHeaders = details.responseHeaders.filter(function(header) {
      return (header.name.toLowerCase() != "set-cookie");
    });
    return {responseHeaders: newHeaders};
  }
}

/*************** Non-blocking listener functions ***************/

/**
 * Event handler when a tab gets removed
 *
 * @param {Integer} tabId Id of the tab
 */
function onTabRemoved(tabId) {
  forgetTab(tabId);
}

/**
 * Update internal db on tabs when a tab gets replaced
 *
 * @param {Integer} addedTabId The new tab id that replaces
 * @param {Integer} removedTabId The tab id that gets removed
 */
function onTabReplaced(addedTabId, removedTabId) {
  forgetTab(removedTabId);
  // Update the badge of the added tab, which was probably used for prerendering.
  badger.updateBadge(addedTabId);
}

/**
 * We don't always get a "main_frame" details object in onBeforeRequest,
 * so we need a fallback for (re)initializing tabData.
 */
function onNavigate(details) {
  const tab_id = details.tabId,
    url = details.url;

  // main (top-level) frames only
  if (details.frameId !== 0) {
    return;
  }

  // forget but don't initialize on special browser/extension pages
  if (utils.isRestrictedUrl(url)) {
    forgetTab(tab_id);
    return;
  }

  forgetTab(tab_id);
  badger.recordFrame(tab_id, 0, url);

  // initialize tab data bookkeeping used by heuristicBlockingAccounting()
  // to avoid missing or misattributing learning
  // when there is no "main_frame" webRequest callback
  // (such as on Service Worker pages)
  //
  // see the tabOrigins TODO in heuristicblocking.js
  // as to why we don't just use tabData
  let base = window.getBaseDomain(badger.tabData[tab_id].frames[0].host);
  badger.heuristicBlocking.tabOrigins[tab_id] = base;
  badger.heuristicBlocking.tabUrls[tab_id] = url;
}

/******** Utility Functions **********/

/**
 * Gets the host name for a given tab id
 * @param {Integer} tabId chrome tab id
 * @return {String} the host name for the tab
 */
function getHostForTab(tabId) {
  var mainFrameIdx = 0;
  if (!badger.tabData[tabId]) {
    return '';
  }
  // TODO what does this actually do?
  // meant to address https://github.com/EFForg/privacybadger/issues/136
  if (_isTabAnExtension(tabId)) {
    // If the tab is an extension get the url of the first frame for its implied URL
    // since the url of frame 0 will be the hash of the extension key
    mainFrameIdx = Object.keys(badger.tabData[tabId].frames)[1] || 0;
  }
  let frameData = badger.getFrameData(tabId, mainFrameIdx);
  if (!frameData) {
    return '';
  }
  return frameData.host;
}

/**
 * Record "supercookie" tracking
 *
 * @param {Integer} tab_id browser tab ID
 * @param {String} frame_url URL of the frame with supercookie
 */
function recordSuperCookie(tab_id, frame_url) {
  if (!incognito.learningEnabled(tab_id)) {
    return;
  }

  const frame_host = window.extractHostFromURL(frame_url),
    page_host = badger.getFrameData(tab_id).host;

  if (!utils.isThirdPartyDomain(frame_host, page_host)) {
    // Only happens on the start page for google.com
    return;
  }

  badger.heuristicBlocking.updateTrackerPrevalence(
    frame_host, window.getBaseDomain(page_host));
}

/**
 * Record canvas fingerprinting
 *
 * @param {Integer} tabId the tab ID
 * @param {Object} msg specific fingerprinting data
 */
function recordFingerprinting(tabId, msg) {
  // Abort if we failed to determine the originating script's URL
  // TODO find and fix where this happens
  if (!msg.scriptUrl) {
    return;
  }
  if (!incognito.learningEnabled(tabId)) {
    return;
  }

  // Ignore first-party scripts
  var script_host = window.extractHostFromURL(msg.scriptUrl),
    document_host = badger.getFrameData(tabId).host;
  if (!utils.isThirdPartyDomain(script_host, document_host)) {
    return;
  }

  var CANVAS_WRITE = {
    fillText: true,
    strokeText: true
  };
  var CANVAS_READ = {
    getImageData: true,
    toDataURL: true
  };

  if (!badger.tabData[tabId].hasOwnProperty('fpData')) {
    badger.tabData[tabId].fpData = {};
  }

  var script_origin = window.getBaseDomain(script_host);

  // Initialize script TLD-level data
  if (!badger.tabData[tabId].fpData.hasOwnProperty(script_origin)) {
    badger.tabData[tabId].fpData[script_origin] = {
      canvas: {
        fingerprinting: false,
        write: false
      }
    };
  }
  var scriptData = badger.tabData[tabId].fpData[script_origin];

  if (msg.extra.hasOwnProperty('canvas')) {
    if (scriptData.canvas.fingerprinting) {
      return;
    }

    // If this script already had a canvas write...
    if (scriptData.canvas.write) {
      // ...and if this is a canvas read...
      if (CANVAS_READ.hasOwnProperty(msg.prop)) {
        // ...and it got enough data...
        if (msg.extra.width > 16 && msg.extra.height > 16) {
          // ...we will classify it as fingerprinting
          scriptData.canvas.fingerprinting = true;
          log(script_host, 'caught fingerprinting on', document_host);

          // Mark this as a strike
          badger.heuristicBlocking.updateTrackerPrevalence(
            script_host, window.getBaseDomain(document_host));
        }
      }
      // This is a canvas write
    } else if (CANVAS_WRITE.hasOwnProperty(msg.prop)) {
      scriptData.canvas.write = true;
    }
  }
}

/**
 * Delete tab data, de-register tab
 *
 * @param {Integer} tabId The id of the tab
 */
function forgetTab(tabId) {
  delete badger.tabData[tabId];
  delete temporaryWidgetUnblock[tabId];
}

/**
 * Determines the action to take on a specific FQDN.
 *
 * @param {Integer} tabId The relevant tab
 * @param {String} requestHost The FQDN
 * @param {Integer} frameId The id of the frame
 * @returns {(String|Boolean)} false or the action to take
 */
function checkAction(tabId, requestHost, frameId) {
  // Ignore requests from temporarily unblocked widgets.
  // Someone clicked the widget, so let it load.
  if (isWidgetTemporaryUnblock(tabId, requestHost, frameId)) {
    return false;
  }

  // Ignore requests from private domains.
  if (window.isPrivateDomain(requestHost)) {
    return false;
  }

  return badger.storage.getBestAction(requestHost);
}

/**
 * Checks if the tab is chrome internal
 *
 * @param {Integer} tabId Id of the tab to test
 * @returns {boolean} Returns true if the tab is chrome internal
 * @private
 */
function _isTabChromeInternal(tabId) {
  if (tabId < 0) {
    return true;
  }

  let frameData = badger.getFrameData(tabId);
  if (!frameData || !frameData.url.startsWith("http")) {
    return true;
  }

  return false;
}

/**
 * Checks if the tab is a chrome-extension tab
 *
 * @param {Integer} tabId Id of the tab to test
 * @returns {boolean} Returns true if the tab is from a chrome-extension
 * @private
 */
function _isTabAnExtension(tabId) {
  let frameData = badger.getFrameData(tabId);
  return (frameData && (
    frameData.url.startsWith("chrome-extension://") ||
    frameData.url.startsWith("moz-extension://")
  ));
}

/**
 * Provides the widget replacing content script with list of widgets to replace.
 *
 * @returns {Object} dict containing the complete list of widgets
 * as well as a mapping to indicate which ones should be replaced
 */
let getWidgetBlockList = (function () {
  // cached translations
  let translations = [];
  // inputs to chrome.i18n.getMessage()
  const widgetTranslations = [
    {
      key: "social_tooltip_pb_has_replaced",
      placeholders: ["XXX"]
    },
    { key: "allow_once" },
  ];

  return function () {
    // A mapping of individual SocialWidget objects to boolean values that determine
    // whether the content script should replace that tracker's button/widget
    var widgetsToReplace = {};

    // optimize translation lookups by doing them just once
    // the first time they are needed
    if (!translations.length) {
      translations = widgetTranslations.reduce((memo, data) => {
        memo[data.key] = chrome.i18n.getMessage(data.key, data.placeholders);
        return memo;
      }, {});
    }

    badger.widgetList.forEach(function (widget) {
      // replace blocked widgets only
      // and only if the widget is not on the 'do not replace' list
      const replace = !badger.getSettings().getItem('widgetReplacementExceptions').includes(widget.name);
      const action = badger.storage.getBestAction(widget.domain);

      widgetsToReplace[widget.name] = replace && (
        action == constants.BLOCK ||
        action == constants.USER_BLOCK
      );
    });

    return {
      translations,
      trackers: badger.widgetList,
      trackerButtonsToReplace: widgetsToReplace
    };
  };
}());

/**
 * Check if tab is temporarily unblocked for tracker
 *
 * @param {Integer} tabId id of the tab to check
 * @param {String} requestHost FQDN to check
 * @param {Integer} frameId frame id to check
 * @returns {Boolean} true if in exception list
 */
function isWidgetTemporaryUnblock(tabId, requestHost, frameId) {
  var exceptions = temporaryWidgetUnblock[tabId];
  if (exceptions === undefined) {
    return false;
  }

  var requestExcept = (exceptions.indexOf(requestHost) != -1);

  var frameHost = badger.getFrameData(tabId, frameId).host;
  var frameExcept = (exceptions.indexOf(frameHost) != -1);

  return (requestExcept || frameExcept);
}

/**
 * Unblocks a tracker just temporarily on this tab, because the user has clicked the
 * corresponding replacement widget.
 *
 * @param {Integer} tabId The id of the tab
 * @param {Array} widgetUrls an array of widget urls
 */
function unblockWidgetOnTab(tabId, widgetUrls) {
  if (temporaryWidgetUnblock[tabId] === undefined) {
    temporaryWidgetUnblock[tabId] = [];
  }
  for (let i in widgetUrls) {
    let url = widgetUrls[i];
    // TODO just store actual domains in the JSON in the first place
    let host = window.extractHostFromURL(url);
    temporaryWidgetUnblock[tabId].push(host);
  }
}

// NOTE: sender.tab is available for content script (not popup) messages only
function dispatcher(request, sender, sendResponse) {

  // messages from content scripts are to be treated with greater caution:
  // https://groups.google.com/a/chromium.org/d/msg/chromium-extensions/0ei-UCHNm34/lDaXwQhzBAAJ
  if (!sender.url.startsWith(chrome.runtime.getURL(""))) {
    // reject unless it's a known content script message
    const KNOWN_CONTENT_SCRIPT_MESSAGES = [
      "checkDNT",
      "checkEnabled",
      "checkEnabledAndThirdParty",
      "checkLocation",
      "checkReplaceButton",
      "checkWidgetReplacementEnabled",
      "fpReport",
      "getReplacementButton",
      "supercookieReport",
      "unblockWidget",
    ];
    if (!KNOWN_CONTENT_SCRIPT_MESSAGES.includes(request.type)) {
      console.error("Rejected unknown message %o from %s", request, sender.url);
      return sendResponse();
    }
  }

  switch (request.type) {

  case "checkEnabled": {
    sendResponse(badger.isPrivacyBadgerEnabled(
      window.extractHostFromURL(sender.tab.url)
    ));

    break;
  }

  case "checkLocation": {
    if (!badger.isPrivacyBadgerEnabled(window.extractHostFromURL(sender.tab.url))) {
      return sendResponse();
    }

    // Ignore requests from internal Chrome tabs.
    if (_isTabChromeInternal(sender.tab.id)) {
      return sendResponse();
    }

    let frame_host = window.extractHostFromURL(request.frameUrl),
      tab_host = window.extractHostFromURL(sender.tab.url);

    // Ignore requests that aren't from a third party.
    if (!frame_host || !utils.isThirdPartyDomain(frame_host, tab_host)) {
      return sendResponse();
    }

    let action = checkAction(sender.tab.id, frame_host);
    sendResponse(action == constants.COOKIEBLOCK || action == constants.USER_COOKIE_BLOCK);

    break;
  }

  case "checkReplaceButton": {
    if (badger.isPrivacyBadgerEnabled(window.extractHostFromURL(sender.tab.url)) && badger.isWidgetReplacementEnabled()) {
      let widgetBlockList = getWidgetBlockList();
      sendResponse(widgetBlockList);
    }

    break;
  }

  case "unblockWidget": {
    let widgetData = badger.widgetList.find(
      widget => widget.name == request.widgetName);
    if (!widgetData ||
        !widgetData.hasOwnProperty("replacementButton") ||
        !widgetData.replacementButton.unblockDomains) {
      return sendResponse();
    }
    unblockWidgetOnTab(sender.tab.id, widgetData.replacementButton.unblockDomains);
    sendResponse();
    break;
  }

  case "getReplacementButton": {
    let widgetData = badger.widgetList.find(
      widget => widget.name == request.widgetName);
    if (!widgetData ||
        !widgetData.hasOwnProperty("replacementButton") ||
        !widgetData.replacementButton.imagePath) {
      return sendResponse();
    }

    let button_path = chrome.runtime.getURL(
      "skin/socialwidgets/" + widgetData.replacementButton.imagePath);

    let image_type = button_path.slice(button_path.lastIndexOf('.') + 1);

    let xhrOptions = {};
    if (image_type != "svg") {
      xhrOptions.responseType = "arraybuffer";
    }

    // fetch replacement button image data
    utils.xhrRequest(button_path, function (err, response) {
      // one data URI for SVGs
      if (image_type == "svg") {
        return sendResponse('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(response));
      }

      // another data URI for all other image formats
      sendResponse(
        'data:image/' + image_type + ';base64,' +
        utils.arrayBufferToBase64(response)
      );
    }, "GET", xhrOptions);

    // indicate this is an async response to chrome.runtime.onMessage
    return true;
  }

  case "fpReport": {
    if (!badger.isPrivacyBadgerEnabled(window.extractHostFromURL(sender.tab.url))) {
      return sendResponse();
    }
    if (Array.isArray(request.data)) {
      request.data.forEach(function (msg) {
        recordFingerprinting(sender.tab.id, msg);
      });
    } else {
      recordFingerprinting(sender.tab.id, request.data);
    }

    break;
  }

  case "supercookieReport": {
    if (request.frameUrl && badger.hasSuperCookie(request.data)) {
      recordSuperCookie(sender.tab.id, request.frameUrl);
    }
    break;
  }

  case "checkEnabledAndThirdParty": {
    let tab_host = window.extractHostFromURL(sender.tab.url),
      frame_host = window.extractHostFromURL(request.frameUrl);

    sendResponse(frame_host &&
      badger.isPrivacyBadgerEnabled(tab_host) &&
      utils.isThirdPartyDomain(frame_host, tab_host));

    break;
  }

  case "checkWidgetReplacementEnabled": {
    sendResponse(
      badger.isPrivacyBadgerEnabled(window.extractHostFromURL(sender.tab.url)) &&
      badger.isWidgetReplacementEnabled()
    );
    break;
  }

  case "getPopupData": {
    let tab_id = request.tabId;

    if (!badger.tabData.hasOwnProperty(tab_id)) {
      sendResponse({
        criticalError: badger.criticalError,
        noTabData: true,
        seenComic: true,
      });
      break;
    }

    let tab_host = window.extractHostFromURL(request.tabUrl),
      origins = badger.tabData[tab_id].origins,
      cookieblocked = {};

    for (let origin in origins) {
      // see if origin would be cookieblocked if not for user override
      if (badger.storage.getCookieblockStatus(origin)) {
        cookieblocked[origin] = true;
      }
    }

    sendResponse({
      cookieblocked,
      criticalError: badger.criticalError,
      enabled: badger.isPrivacyBadgerEnabled(tab_host),
      errorText: badger.tabData[tab_id].errorText,
      noTabData: false,
      origins,
      seenComic: badger.getSettings().getItem("seenComic"),
      showNonTrackingDomains: badger.getSettings().getItem("showNonTrackingDomains"),
      tabHost: tab_host,
      tabId: tab_id,
      tabUrl: request.tabUrl,
      trackerCount: badger.getTrackerCount(tab_id)
    });

    break;
  }

  case "getOptionsData": {
    let origins = badger.storage.getTrackingDomains();

    let cookieblocked = {};
    for (let origin in origins) {
      // see if origin would be cookieblocked if not for user override
      if (badger.storage.getCookieblockStatus(origin)) {
        cookieblocked[origin] = true;
      }
    }

    sendResponse({
      cookieblocked,
      disabledSites: badger.getDisabledSites(),
      isCheckingDNTPolicyEnabled: badger.isCheckingDNTPolicyEnabled(),
      isDNTSignalEnabled: badger.isDNTSignalEnabled(),
      isLearnInIncognitoEnabled: badger.isLearnInIncognitoEnabled(),
      isWidgetReplacementEnabled: badger.isWidgetReplacementEnabled(),
      origins,
      showCounter: badger.showCounter(),
      showNonTrackingDomains: badger.getSettings().getItem("showNonTrackingDomains"),
      showTrackingDomains: badger.getSettings().getItem("showTrackingDomains"),
      webRTCAvailable: badger.webRTCAvailable,
      widgetReplacementExceptions: badger.getSettings().getItem("widgetReplacementExceptions"),
      widgets: badger.widgetList.map(widget => widget.name),
    });

    break;
  }

  case "resetData": {
    badger.storage.clearTrackerData();
    badger.loadSeedData();
    sendResponse();
    break;
  }

  case "removeAllData": {
    badger.storage.clearTrackerData();
    sendResponse();
    break;
  }

  case "seenComic": {
    badger.getSettings().setItem("seenComic", true);
    break;
  }

  case "activateOnSite": {
    badger.enablePrivacyBadgerForOrigin(request.tabHost);
    badger.refreshIconAndContextMenu(request.tabId, request.tabUrl);
    sendResponse();
    break;
  }

  case "deactivateOnSite": {
    badger.disablePrivacyBadgerForOrigin(request.tabHost);
    badger.refreshIconAndContextMenu(request.tabId, request.tabUrl);
    sendResponse();
    break;
  }

  case "revertDomainControl": {
    badger.storage.revertUserAction(request.origin);
    sendResponse({
      origins: badger.storage.getTrackingDomains()
    });
    break;
  }

  case "downloadCloud": {
    chrome.storage.sync.get("disabledSites", function (store) {
      if (chrome.runtime.lastError) {
        sendResponse({success: false, message: chrome.runtime.lastError.message});
      } else if (store.hasOwnProperty("disabledSites")) {
        let whitelist = _.union(
          badger.getDisabledSites(),
          store.disabledSites
        );
        badger.getSettings().setItem("disabledSites", whitelist);
        sendResponse({
          success: true,
          disabledSites: whitelist
        });
      } else {
        sendResponse({
          success: false,
          message: chrome.i18n.getMessage("download_cloud_no_data")
        });
      }
    });

    // indicate this is an async response to chrome.runtime.onMessage
    return true;
  }

  case "uploadCloud": {
    let obj = {};
    obj.disabledSites = badger.getDisabledSites();
    chrome.storage.sync.set(obj, function () {
      if (chrome.runtime.lastError) {
        sendResponse({success: false, message: chrome.runtime.lastError.message});
      } else {
        sendResponse({success: true});
      }
    });
    // indicate this is an async response to chrome.runtime.onMessage
    return true;
  }

  case "savePopupToggle": {
    let domain = request.origin,
      action = request.action;

    badger.saveAction(action, domain);

    // update cached tab data so that a reopened popup displays correct state
    badger.tabData[request.tabId].origins[domain] = "user_" + action;

    break;
  }

  case "saveOptionsToggle": {
    // called when the user manually sets a slider on the options page
    badger.saveAction(request.action, request.origin);
    sendResponse({
      origins: badger.storage.getTrackingDomains()
    });
    break;
  }

  case "mergeUserData": {
    // called when a user uploads data exported from another Badger instance
    badger.mergeUserData(request.data);
    sendResponse({
      disabledSites: badger.getDisabledSites(),
      origins: badger.storage.getTrackingDomains(),
    });
    break;
  }

  case "updateSettings": {
    const settings = badger.getSettings();
    for (let key in request.data) {
      if (badger.defaultSettings.hasOwnProperty(key)) {
        settings.setItem(key, request.data[key]);
      } else {
        console.error("Unknown Badger setting:", key);
      }
    }
    sendResponse();
    break;
  }

  case "updateBadge": {
    let tab_id = request.tab_id;
    badger.updateBadge(tab_id);
    sendResponse();
    break;
  }

  case "disablePrivacyBadgerForOrigin": {
    badger.disablePrivacyBadgerForOrigin(request.domain);
    sendResponse({
      disabledSites: badger.getDisabledSites()
    });
    break;
  }

  case "enablePrivacyBadgerForOriginList": {
    request.domains.forEach(function (domain) {
      badger.enablePrivacyBadgerForOrigin(domain);
    });
    sendResponse({
      disabledSites: badger.getDisabledSites()
    });
    break;
  }

  case "removeOrigin": {
    badger.storage.getBadgerStorageObject("snitch_map").deleteItem(request.origin);
    badger.storage.getBadgerStorageObject("action_map").deleteItem(request.origin);
    sendResponse({
      origins: badger.storage.getTrackingDomains()
    });
    break;
  }

  case "saveErrorText": {
    let activeTab = badger.tabData[request.tabId];
    activeTab.errorText = request.errorText;
    break;
  }

  case "removeErrorText": {
    let activeTab = badger.tabData[request.tabId];
    delete activeTab.errorText;
    break;
  }

  case "checkDNT": {
    // called from contentscripts/dnt.js to check if we should enable it
    sendResponse(
      badger.isDNTSignalEnabled()
      && badger.isPrivacyBadgerEnabled(
        window.extractHostFromURL(sender.tab.url)
      )
    );
    break;
  }

  }
}

/*************** Event Listeners *********************/
function startListeners() {
  chrome.webNavigation.onBeforeNavigate.addListener(onNavigate);

  chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, {urls: ["http://*/*", "https://*/*"]}, ["blocking"]);

  let extraInfoSpec = ['requestHeaders', 'blocking'];
  if (chrome.webRequest.OnBeforeSendHeadersOptions.hasOwnProperty('EXTRA_HEADERS')) {
    extraInfoSpec.push('extraHeaders');
  }
  chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, {urls: ["http://*/*", "https://*/*"]}, extraInfoSpec);

  extraInfoSpec = ['responseHeaders', 'blocking'];
  if (chrome.webRequest.OnHeadersReceivedOptions.hasOwnProperty('EXTRA_HEADERS')) {
    extraInfoSpec.push('extraHeaders');
  }
  chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, {urls: ["<all_urls>"]}, extraInfoSpec);

  chrome.tabs.onRemoved.addListener(onTabRemoved);
  chrome.tabs.onReplaced.addListener(onTabReplaced);
  chrome.runtime.onMessage.addListener(dispatcher);
}

/************************************** exports */
var exports = {};
exports.startListeners = startListeners;
return exports;
/************************************** exports */
})();
