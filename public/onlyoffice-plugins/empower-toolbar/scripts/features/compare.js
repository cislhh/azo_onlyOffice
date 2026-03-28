(function (window) {
  var FEATURE_ID = "empower_compare_document";
  var PLUGIN_MESSAGE_SOURCE = "empower-toolbar-plugin";
  var PLUGIN_MESSAGE_TYPE_COMPARE_FILE = "empower-toolbar:compare-file-selected";
  var MAX_DOC_SIZE = 10 * 1024 * 1024;
  var fileInput = null;
  var featureContext = null;

  function showMessage(message) {
    if (featureContext && typeof featureContext.showMessage === "function") {
      featureContext.showMessage(message);
      return;
    }
    window.alert(message);
  }

  function validateDocxFile(file) {
    if (!file) return "请选择 docx 文档";

    var ext = "";
    if (typeof file.name === "string" && file.name.indexOf(".") >= 0) {
      ext = file.name.split(".").pop().toLowerCase();
    }

    if (ext !== "docx") {
      return "仅支持上传 .docx 作为对比文档";
    }

    if (file.size > MAX_DOC_SIZE) {
      return "对比文档大小不能超过 10MB";
    }

    return "";
  }

  function sendCompareFileToHost(file) {
    var payload = {
      source: PLUGIN_MESSAGE_SOURCE,
      type: PLUGIN_MESSAGE_TYPE_COMPARE_FILE,
      file: file,
      fileName: file.name,
      timestamp: Date.now(),
      version: featureContext ? featureContext.pluginVersion : "",
    };

    try {
      if (window.top && typeof window.top.postMessage === "function") {
        window.top.postMessage(payload, "*");
        return true;
      }
    } catch (error) {}

    try {
      if (window.parent && typeof window.parent.postMessage === "function") {
        window.parent.postMessage(payload, "*");
        return true;
      }
    } catch (error) {}

    return false;
  }

  async function onFileChanged(event) {
    var file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;

    var validationError = validateDocxFile(file);
    if (validationError) {
      showMessage(validationError);
      return;
    }

    if (!sendCompareFileToHost(file)) {
      showMessage("无法触发文档对比，请稍后重试");
    }
  }

  function createFileInput() {
    if (fileInput) return fileInput;

    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept =
      ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", onFileChanged);
    document.body.appendChild(fileInput);
    return fileInput;
  }

  function openDocPicker() {
    var input = createFileInput();
    input.value = "";
    input.click();
  }

  var feature = {
    id: FEATURE_ID,
    availability: {
      modes: ["edit"],
      fileTypes: ["docx"],
      messageByMode: "当前工作模式不支持文档对比",
      messageByFileType: "文档对比仅支持 .docx 格式",
    },
    getToolbarItem: function (context) {
      return {
        id: FEATURE_ID,
        type: "button",
        text: "文档对比",
        hint: "选择修订文档并触发对比",
        icons: context.toolbarIconPath,
        lockInViewMode: true,
        split: false,
        enableToggle: false,
      };
    },
    onInit: function (context) {
      featureContext = context;
      createFileInput();
    },
    onClick: function () {
      openDocPicker();
    },
  };

  window.EmpowerToolbarFeatures = window.EmpowerToolbarFeatures || [];
  window.EmpowerToolbarFeatures.push(feature);
})(window);
