$(document).ready(function() {
    startPreview(true);
});

function translateBaseHtmlPage() {
    var refiqdaPreviewText = $.i18n( "refiqdaPreviewText" ); 
    $( '.refiqdaPreviewText' ).text( refiqdaPreviewText );
}

function writeContentAndData(data, fileUrl, file, title, authors) {
    addStandardPreviewHeader(file,title, authors);
    options = {"stripIgnoreTag":true,
        "stripIgnoreTagBody":['script','head']};  // Custom rules

    parser = new DOMParser();
    xmlDoc = parser.parseFromString(data,"text/xml");

    var codebook = xmlDoc.getElementsByTagName("CodeBook");
    var codes = codebook[0].getElementsByTagName("Code");
    for (let code of codes) {
        $('.preview').append($("<div/>").html("<p>Code: " + code.getAttribute('name') + "</p>"));
    }

}
