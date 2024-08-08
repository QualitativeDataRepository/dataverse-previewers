$(document).ready(function() {
    startPreview(false);
});

function translateBaseHtmlPage() {
    var videoPreviewText = $.i18n("videoPreviewText");
    $('.videoPreviewText').text(videoPreviewText);
}

function writeContent(fileUrl, file, title, authors) {
    // Currently the styling of Voyager hides this info anyway.
    //    addStandardPreviewHeader(file, title, authors);
    const lastIndexOfChar = fileUrl.lastIndexOf("/");
    const rootUrl = fileUrl.substring(0, lastIndexOfChar + 1);
    const fileName = fileUrl.substring(lastIndexOfChar + 1);
    console.log(fileUrl);
    $("voyager-explorer").attr("root", rootUrl).attr("model", fileName);
    $.getScript("lib/voyager-explorer.min.v0.42.1.gdcc.js");
}