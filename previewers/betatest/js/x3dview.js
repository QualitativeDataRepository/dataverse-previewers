$(document).ready(function() {
    startPreview(true);
});
    
function translateBaseHtmlPage() {
    var x3dPreviewText = $.i18n( "x3dPreviewText" );
    $( '.x3dPreviewText' ).text( x3dPreviewText );
}

function writeContentAndData(data, fileUrl, file, title, authors) {
    addStandardPreviewHeader(file, title, authors);

    $('.preview').append($("<pre/>").html(fileUrl));
    
    options = {};  // Custom rules
    $('.preview').append($("<pre/>").html(filterXSS(data,options)));
    
    var browser = X3D.getBrowser("x3d-canvas#x3dpreviewcanvas");
    console.log("Version: " + browser.getVersion());
    browser.loadURL(new X3D.MFString(fileUrl));
    //browser.replaceWorld(browser.createX3DFromString(data));
    //browser.viewAll();
    //browser.reload();
}
