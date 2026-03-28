(function (window) {
  var PLUGIN_VERSION = "20260327.11";
  var TOOLBAR_TAB_ID = "empower_tools_tab";
  var TOOLBAR_ICON_PATH = "resources/icon.png";
  var PLUGIN_MESSAGE_SOURCE = "empower-toolbar-plugin";
  var PLUGIN_MESSAGE_TYPE_REQUEST_RUNTIME = "empower-toolbar:request-runtime-context";
  var PLUGIN_MESSAGE_TYPE_RUNTIME_CONTEXT = "empower-toolbar:runtime-context";
  var toolbarMounted = false;
  var toolbarFeaturesById = Object.create(null);
  var runtimeContext = null;

  function showMessage(message) {
    window.alert(message);
  }

  function normalizeRuntimeContext(context) {
    if (!context || typeof context !== "object") return null;

    var mode = typeof context.mode === "string" ? context.mode.toLowerCase() : "";
    var fileType =
      typeof context.fileType === "string" ? context.fileType.toLowerCase() : "";

    if (!mode || !fileType) return null;

    return {
      mode: mode,
      fileType: fileType,
    };
  }

  function requestRuntimeContext() {
    var payload = {
      source: PLUGIN_MESSAGE_SOURCE,
      type: PLUGIN_MESSAGE_TYPE_REQUEST_RUNTIME,
      timestamp: Date.now(),
      version: PLUGIN_VERSION,
    };

    try {
      if (window.top && typeof window.top.postMessage === "function") {
        window.top.postMessage(payload, "*");
      }
    } catch (error) {}

    try {
      if (window.parent && typeof window.parent.postMessage === "function") {
        window.parent.postMessage(payload, "*");
      }
    } catch (error) {}
  }

  function isFeatureAvailable(feature) {
    if (!feature || !feature.availability) {
      return {
        available: true,
      };
    }

    var availability = feature.availability;
    if (!runtimeContext) {
      return {
        available: false,
        message:
          availability.pendingMessage || "正在获取文档状态，请稍后再试",
      };
    }

    if (
      Array.isArray(availability.modes) &&
      availability.modes.length > 0 &&
      availability.modes.indexOf(runtimeContext.mode) === -1
    ) {
      return {
        available: false,
        message:
          availability.messageByMode ||
          availability.message ||
          "当前工作模式不可用",
      };
    }

    if (
      Array.isArray(availability.fileTypes) &&
      availability.fileTypes.length > 0 &&
      availability.fileTypes.indexOf(runtimeContext.fileType) === -1
    ) {
      return {
        available: false,
        message:
          availability.messageByFileType ||
          availability.message ||
          "当前文档格式不可用",
      };
    }

    return {
      available: true,
    };
  }

  function getFeatures() {
    var features = window.EmpowerToolbarFeatures;
    if (!Array.isArray(features)) {
      return [];
    }

    return features.filter(function (feature) {
      return (
        feature &&
        typeof feature.id === "string" &&
        typeof feature.getToolbarItem === "function" &&
        typeof feature.onClick === "function"
      );
    });
  }

  function createFeatureContext() {
    return {
      pluginVersion: PLUGIN_VERSION,
      toolbarIconPath: TOOLBAR_ICON_PATH,
      showMessage: showMessage,
      runtimeContext: runtimeContext,
      asc: window.Asc,
      plugin: window.Asc && window.Asc.plugin ? window.Asc.plugin : null,
    };
  }

  function mountToolbar(features, context) {
    if (toolbarMounted) return;
    toolbarMounted = true;

    var items = features
      .map(function (feature) {
        return feature.getToolbarItem(context);
      })
      .filter(Boolean);

    window.Asc.plugin.executeMethod("AddToolbarMenuItem", [
      {
        guid: window.Asc.plugin.guid,
        tabs: [
          {
            id: TOOLBAR_TAB_ID,
            text: "业务工具",
            items: items,
          },
        ],
      },
    ]);
  }

  function registerFeatureHandlers(features, context) {
    toolbarFeaturesById = Object.create(null);

    features.forEach(function (feature) {
      toolbarFeaturesById[feature.id] = feature;
      if (typeof feature.onInit === "function") {
        feature.onInit(context);
      }
    });

    if (typeof window.Asc.plugin.attachToolbarMenuClickEvent === "function") {
      features.forEach(function (feature) {
        window.Asc.plugin.attachToolbarMenuClickEvent(feature.id, function () {
          feature.onClick(context);
        });
      });
    }
  }

  function dispatchToolbarClick(id) {
    var feature = toolbarFeaturesById[id];
    if (!feature) return;

    requestRuntimeContext();
    var availability = isFeatureAvailable(feature);
    if (!availability.available) {
      showMessage(availability.message);
      return;
    }

    var context = createFeatureContext();
    feature.onClick(context);
  }

  function onMessage(event) {
    var data = event && event.data;
    if (!data || typeof data !== "object") return;
    if (data.source !== PLUGIN_MESSAGE_SOURCE) return;
    if (data.type !== PLUGIN_MESSAGE_TYPE_RUNTIME_CONTEXT) return;

    var context = normalizeRuntimeContext(data.context);
    if (!context) return;

    runtimeContext = context;
  }

  window.Asc.plugin.init = function () {
    if (window.console && typeof window.console.log === "function") {
      window.console.log("[empower-toolbar] init version:", PLUGIN_VERSION);
    }

    window.addEventListener("message", onMessage);
    requestRuntimeContext();

    var features = getFeatures();
    var context = createFeatureContext();
    mountToolbar(features, context);
    registerFeatureHandlers(features, context);
  };

  window.Asc.plugin.event_onToolbarMenuClick = function (id) {
    dispatchToolbarClick(id);
  };

  window.Asc.plugin.button = function () {};
})(window);
