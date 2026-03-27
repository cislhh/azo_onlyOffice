(function(window, undefined){

    var text = "机密文件"; // 定义你想要插入的水印文本

    window.Asc.plugin.init = function() {
        // 1. 将变量导出到插件作用域，以便 callCommand 内部可以访问
        Asc.scope.watermarkText = text;

        // 2. 执行文档指令
        this.callCommand(function() {
            var doc = Api.GetDocument();

            // 插入水印
            // 注意：InsertWatermark 是在文档中启用水印功能的关键步
            doc.InsertWatermark("", true);

            var watermarkSettings = doc.GetWatermarkSettings();

            // 配置文本水印属性
            watermarkSettings.SetType("text");
            // 使用从外部传进来的变量 Asc.scope.watermarkText
            watermarkSettings.SetText(Asc.scope.watermarkText);

            var textPr = watermarkSettings.GetTextPr();
            textPr.SetFontSize(100 * 2); // API 有时以半磅为单位，100pt 建议写 200 或根据需要调整
            textPr.SetColor(255, 0, 0, false); // 红色 (R, G, B, isShading)

            watermarkSettings.SetDirection("diagonal"); // 对角线
            watermarkSettings.SetOpacity(50); // 50% 透明度
            watermarkSettings.SetTextPr(textPr);

            // 应用设置
            doc.SetWatermarkSettings(watermarkSettings);

        }, true); // true 表示执行后刷新界面渲染

        // 移除了错误的 break;
    };

    window.Asc.plugin.button = function(id) {
        this.executeCommand("close", "");
    };

})(window, undefined);