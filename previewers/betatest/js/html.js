$(document).ready(function() {
    startPreview(true);
});

function translateBaseHtmlPage() {
    var htmlPreviewText = $.i18n( "htmlPreviewText" ); 
    $( '.htmlPreviewText' ).text( htmlPreviewText );
}

function writeContentAndData(data, fileUrl, file, title, authors) {
    addStandardPreviewHeader(file,title, authors);
    //QDR is a curated repository and as such, it allows original (but curated) HTML to be displayed without removing some tags 
    $('.preview').append($("<div/>").html(data));
}
