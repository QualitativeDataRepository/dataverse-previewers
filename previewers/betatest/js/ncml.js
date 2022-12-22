$(document).ready(function () {
    startPreview(false);
});

function translateBaseHtmlPage() {
    var ncmlPreviewText = $.i18n("ncmlPreviewText");
    $('.ncmlPreviewText').text(ncmlPreviewText);
}

function writeContent(fileUrl, file, title, authors) {
    addStandardPreviewHeader(file, title, authors);
    var ncmlUrl = queryParams.get("siteUrl") + "/api/access/datafile/" + queryParams.get("fileid") + "/auxiliary/NcML/0.1";
    $.ajax({
        type: 'GET',
        dataType: 'text',
        crosssite: true,
        url: ncmlUrl,
        success: function (data, status) {
            $('.preview').append($("<textarea/>").html(data)
                .attr('style', 'width:100%;height:100%;')
            );
        },
        error: function (request, status, error) {
            reportFailure($.i18n("ncmlErrorText"), error);
        }
    });
}
