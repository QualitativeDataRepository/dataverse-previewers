$(document).ready(function () {

    const MESSAGE = "🚨 ATTENTION 🚨\n\nThis data file includes JavaScript which may need to run for the data to display properly.\n\nYou can click the OK to allow the JavaScript to run, but be sure you trust this datafile as a malicious JavaScript could harm your computer (with the same concerns as if you went to a malicious website outside of Dataverse).\n\nIf you wish to not run the complete page, click Abort to be redirected to Dataverse."

    userConfirms = confirm(MESSAGE)

    if (userConfirms) {
        // Preview the HTML file
        startPreview(true);
    } else {
        // Redirect back to the dataset
        queryParams = new URLSearchParams(window.location.search.substring(1));
        let siteURL = queryParams.get("siteUrl")
        let datasetId = queryParams.get("datasetid")

        if (siteURL.endsWith("/")) {
            siteURL = siteURL.substring(0, siteURL.length - 1)
        }

        let redirectUrl = siteURL + "/dataset.xhtml?id=" + datasetId
        window.location.replace(redirectUrl);
    }
});

function translateBaseHtmlPage() {
    var htmlPreviewText = $.i18n("htmlPreviewText");
    $('.htmlPreviewText').text(htmlPreviewText);
}

function writeContentAndData(data, fileUrl, file, title, authors) {
    addStandardPreviewHeader(file, title, authors);
    options = {
        "stripIgnoreTag": true,
    };  // Custom rules

    $('.preview').append($("<div/>").html(data));
}
