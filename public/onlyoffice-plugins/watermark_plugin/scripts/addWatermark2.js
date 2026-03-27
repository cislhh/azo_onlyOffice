(function(window, undefined){

    window.Asc.plugin.init = function() {

        this.callCommand(function() {
            let doc = Api.GetDocument();
            let watermarkSettings = doc.GetWatermarkSettings();
            watermarkSettings.SetType("image");
            var u1='https://static.onlyoffice.com/assets/docs/samples/img/onlyoffice_logo.png'
            watermarkSettings.SetImageURL(u1);
            watermarkSettings.SetImageSize(36000 * 70, 36000 * 80);
            watermarkSettings.SetDirection("clockwise45");
            watermarkSettings.SetOpacity(200);
            doc.SetWatermarkSettings(watermarkSettings);

        }, true); // true 表示执行后刷新界面渲染

    };

    window.Asc.plugin.button = function(id) {
//        this.executeCommand("close", "");
    };

})(window, undefined);