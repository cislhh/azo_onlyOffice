(function (window) {
  var FEATURE_ID = "empower_insert_stamp";
  var FIXED_STAMP_WIDTH_EMU = 160 * 9525;
  var FIXED_STAMP_HEIGHT_EMU = 160 * 9525;
  var FIXED_STAMP_MARGIN_EMU = 8 * 36000;
  var MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  var fileInput = null;
  var featureContext = null;

  function showMessage(message) {
    if (featureContext && typeof featureContext.showMessage === "function") {
      featureContext.showMessage(message);
      return;
    }
    window.alert(message);
  }

  function createFileInput() {
    if (fileInput) return fileInput;

    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/png,image/jpeg,image/jpg,image/gif,image/webp";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", onFileChanged);
    document.body.appendChild(fileInput);
    return fileInput;
  }

  function openImagePicker() {
    var input = createFileInput();
    input.value = "";
    input.click();
  }

  function readAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(new Error("读取图片失败"));
      };
      reader.readAsDataURL(file);
    });
  }

  function measureImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        var maxWidthPx = 180;
        var ratio = image.width > maxWidthPx ? maxWidthPx / image.width : 1;
        var widthPx = Math.max(24, Math.round(image.width * ratio));
        var heightPx = Math.max(24, Math.round(image.height * ratio));

        resolve({
          widthEmu: widthPx * 9525,
          heightEmu: heightPx * 9525,
        });
      };
      image.onerror = function () {
        reject(new Error("解析图片尺寸失败"));
      };
      image.src = dataUrl;
    });
  }

  function insertStampImage(dataUrl, widthEmu, heightEmu) {
    Asc.scope.imageSrc = dataUrl;
    Asc.scope.widthEmu = widthEmu;
    Asc.scope.heightEmu = heightEmu;
    Asc.scope.fixedStampWidthEmu = FIXED_STAMP_WIDTH_EMU;
    Asc.scope.fixedStampHeightEmu = FIXED_STAMP_HEIGHT_EMU;
    Asc.scope.fixedStampMarginEmu = FIXED_STAMP_MARGIN_EMU;

    window.Asc.plugin.callCommand(
      function () {
        var imageSrc = Asc.scope.imageSrc;
        var width = Asc.scope.widthEmu;
        var height = Asc.scope.heightEmu;
        var fixedStampWidth = Asc.scope.fixedStampWidthEmu;
        var fixedStampHeight = Asc.scope.fixedStampHeightEmu;
        var fixedStampMargin = Asc.scope.fixedStampMarginEmu;

        try {
          if (typeof Api.GetActiveSheet === "function") {
            var sheet = Api.GetActiveSheet();
            if (sheet && typeof sheet.AddImage === "function") {
              sheet.AddImage(imageSrc, width, height, 0, 2 * 36000, 0, 2 * 36000);
              return;
            }
          }
        } catch (error) {}

        try {
          if (typeof Api.GetPresentation === "function") {
            var presentation = Api.GetPresentation();
            var slide =
              presentation && typeof presentation.GetCurrentSlide === "function"
                ? presentation.GetCurrentSlide()
                : presentation && typeof presentation.GetSlideByIndex === "function"
                  ? presentation.GetSlideByIndex(0)
                  : null;

            var imageObject = Api.CreateImage(imageSrc, width, height);
            if (imageObject && typeof imageObject.SetPosition === "function") {
              imageObject.SetPosition(2 * 36000, 2 * 36000);
            }
            if (slide && typeof slide.AddObject === "function") {
              slide.AddObject(imageObject);
              return;
            }
          }
        } catch (error) {}

        try {
          if (typeof Api.GetDocument === "function") {
            var doc = Api.GetDocument();
            var image = Api.CreateImage(imageSrc, fixedStampWidth, fixedStampHeight);

            if (image && typeof image.SetWrappingStyle === "function") {
              image.SetWrappingStyle("inFront");
            }
            if (image && typeof image.SetHorAlign === "function") {
              image.SetHorAlign("page", "right");
            }
            if (image && typeof image.SetVerAlign === "function") {
              image.SetVerAlign("page", "bottom");
            }
            if (image && typeof image.SetDistances === "function") {
              image.SetDistances(
                fixedStampMargin,
                fixedStampMargin,
                fixedStampMargin,
                fixedStampMargin
              );
            }

            if (
              doc &&
              typeof doc.AddDrawingToPage === "function" &&
              typeof doc.GetCurrentPage === "function"
            ) {
              var twipToEmu = 635;
              var currentPage = doc.GetCurrentPage();
              var x = fixedStampMargin;
              var y = fixedStampMargin;

              if (typeof doc.GetFinalSection === "function") {
                var section = doc.GetFinalSection();
                if (
                  section &&
                  typeof section.GetPageWidth === "function" &&
                  typeof section.GetPageHeight === "function" &&
                  typeof section.GetPageMarginRight === "function" &&
                  typeof section.GetPageMarginBottom === "function"
                ) {
                  var pageWidthEmu = section.GetPageWidth() * twipToEmu;
                  var pageHeightEmu = section.GetPageHeight() * twipToEmu;
                  var rightMarginEmu = section.GetPageMarginRight() * twipToEmu;
                  var bottomMarginEmu = section.GetPageMarginBottom() * twipToEmu;
                  x = Math.max(
                    0,
                    pageWidthEmu - rightMarginEmu - fixedStampWidth - fixedStampMargin
                  );
                  y = Math.max(
                    0,
                    pageHeightEmu - bottomMarginEmu - fixedStampHeight - fixedStampMargin
                  );
                }
              }

              doc.AddDrawingToPage(image, currentPage, x, y);
              return;
            }

            var paragraph =
              doc && typeof doc.GetCurrentParagraph === "function"
                ? doc.GetCurrentParagraph()
                : null;

            if (!paragraph && doc && typeof doc.GetElement === "function") {
              paragraph = doc.GetElement(0);
            }

            if (
              !paragraph &&
              doc &&
              typeof doc.Push === "function" &&
              typeof Api.CreateParagraph === "function"
            ) {
              paragraph = Api.CreateParagraph();
              doc.Push(paragraph);
            }

            if (paragraph && typeof paragraph.AddDrawing === "function") {
              paragraph.AddDrawing(image);
              return;
            }

            if (doc && typeof doc.GetPage === "function") {
              var page = doc.GetPage(0);
              if (page && typeof page.AddObject === "function") {
                if (image && typeof image.SetPosition === "function") {
                  image.SetPosition(2 * 36000, 2 * 36000);
                }
                page.AddObject(image);
              }
            }
          }
        } catch (error) {}
      },
      false,
      true,
      function () {
        if (window.console && typeof window.console.log === "function") {
          window.console.log("[empower-toolbar] stamp inserted");
        }
      }
    );
  }

  function validateImage(file) {
    var validTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
    ];

    if (!validTypes.includes(file.type)) {
      return "请选择 PNG、JPG、GIF 或 WebP 格式的图片";
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return "图片大小不能超过 5MB";
    }

    return "";
  }

  async function onFileChanged(event) {
    var file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;

    var validationError = validateImage(file);
    if (validationError) {
      showMessage(validationError);
      return;
    }

    try {
      var dataUrl = await readAsDataUrl(file);
      var size = await measureImage(dataUrl);
      insertStampImage(dataUrl, size.widthEmu, size.heightEmu);
    } catch (error) {
      showMessage("插入印章失败，请重试");
    }
  }

  var feature = {
    id: FEATURE_ID,
    getToolbarItem: function (context) {
      return {
        id: FEATURE_ID,
        type: "button",
        text: "插入印章",
        hint: "上传印章图片并插入到文档",
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
      openImagePicker();
    },
  };

  window.EmpowerToolbarFeatures = window.EmpowerToolbarFeatures || [];
  window.EmpowerToolbarFeatures.push(feature);
})(window);
