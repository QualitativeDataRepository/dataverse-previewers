$(document).ready(function () {
    startPreview(false);
});

function translateBaseHtmlPage() {
    var mdPreviewText = $.i18n("mdPreviewText");
    $('.mdPreviewText').text(mdPreviewText);
}

function writeContentAndData(data, fileUrl, file, title, authors) {
    addStandardPreviewHeader(file, title, authors);
    const showdown = require('showdown');
    const converter = new showdown.Converter();
    const html = converter.makeHtml(data);
    $('.preview').append($("<textarea/>").html(html));
}
