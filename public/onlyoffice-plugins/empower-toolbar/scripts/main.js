(function (window) {
  var PLUGIN_VERSION = "20260327.11";
  var TOOLBAR_TAB_ID = "empower_tools_tab";
  var TOOLBAR_ICON_PATH = "resources/icon.png";
  var toolbarMounted = false;
  var toolbarFeaturesById = Object.create(null);

  function showMessage(message) {
    window.alert(message);
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

    var context = createFeatureContext();
    feature.onClick(context);
  }

  window.Asc.plugin.init = function () {
    if (window.console && typeof window.console.log === "function") {
      window.console.log("[empower-toolbar] init version:", PLUGIN_VERSION);
    }

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
