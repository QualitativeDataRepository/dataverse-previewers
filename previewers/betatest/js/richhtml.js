$(document).ready(function () {

    const MESSAGE = $.i18n("richHtmlPreviewText")
    userConfirms = confirm(MESSAGE)

    if (userConfirms) {
        // Preview the HTML file
        startPreview(true);
    } else {
        // Redirect to the file page
        queryParams = new URLSearchParams(window.location.search.substring(1));
        var siteUrl = queryParams.get("siteUrl");
        var fileID = queryParams.get("fileid");
        var versionUrl = siteUrl + "/api/datasets/"
            + queryParams.get("datasetid") + "/versions/"
            + queryParams.get("datasetversion");

        fetchMetaAndRedirect(versionUrl, fileID, siteUrl);
    }
});

function fetchMetaAndRedirect(versionURL, fileID, siteUrl) {
    $.ajax({
        type: 'GET',
        dataType: "json",
        crosssite: true,
        url: versionURL,
        success: function (data, status) {
            console.log(data);
            redirectToFilePage(data, siteUrl, fileID);
        },
        error: function (request, status, error) {
            alert("Could not find persistent ID for file. Redirecting to the Dataverse page.")
            window.location.replace(siteUrl);
        }
    });
}

function redirectToFilePage(data, siteUrl, fileID) {
    // Search for the file ID in the JSON
    const files = data.data.files
    const persistentFile = files.find(file => file.dataFile.id == fileID)
    const persistentFileId = persistentFile.dataFile.persistentId
    const fileVersion = persistentFile.version

    // Redirect to the file page
    const fileUrl = siteUrl + "/file.xhtml?persistentId=" + persistentFileId + "&version=" + fileVersion
    window.location.replace(fileUrl);
}

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
