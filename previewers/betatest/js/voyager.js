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
    //For Dataverse 6.4+, this can use the standard script:
    //$.getScript("https://3d-api.si.edu/resources/js/v0.42.1/voyager-explorer.min.js");
    $.getScript("lib/voyager-explorer.v0.42.1.gdcc.min.js");
}