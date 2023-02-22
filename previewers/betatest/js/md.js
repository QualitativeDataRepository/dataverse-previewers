$(document).ready(function () {
    startPreview(false);
});

function translateBaseHtmlPage() {
    var mdPreviewText = $.i18n("mdPreviewText");
    $('.mdPreviewText').text(mdPreviewText);
}

function writeContent(fileUrl, file, title, authors) {
    addStandardPreviewHeader(file, title, authors);
    var mdUrl = queryParams.get("siteUrl") + "/api/access/datafile/" + queryParams.get("fileid") + "/auxiliary/Markdown/1.0.1";

    $.ajax({
        type: 'GET',
        dataType: 'text',
        crosssite: true,
        url: mdUrl,
        success: function (data, status) {
            $('.preview').append($("<textarea/>").html(() => {
                const showdown = require('showdown');
                const converter = new showdown.Converter();
                const html = converter.makeHtml(data);
                return html;
            }
            ).attr('style', 'width:100%;height:100%;')
            );
},
error: function (request, status, error) {
    reportFailure($.i18n("mdErrorText"), error);
}
    });
}
