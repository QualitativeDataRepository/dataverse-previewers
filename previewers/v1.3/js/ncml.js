$(document).ready(function() {
    startPreview(false);
});

function translateBaseHtmlPage() {
    var ncmlPreviewText = $.i18n( "ncmlPreviewText" );
    $( '.ncmlPreviewText' ).text( ncmlPreviewText );
}

function writeContentAndData(data, fileUrl, file, title, authors) {
    addStandardPreviewHeader(file, title, authors);
    $('.preview').append($("<textarea/>").html(data)
    .attr('style','width:100%;height:100%;')
    );
}