function writeContent(fileUrl, file, title, authors) {
    addStandardPreviewHeader(file, title, authors);
    options = {
        "stripIgnoreTag": true,
        "stripIgnoreTagBody": ['script', 'head']
    };  // Custom rules
    var request = new XMLHttpRequest();
    console.log('About to Get ' + fileUrl);
    request.open('GET', fileUrl, true);
    request.responseType = 'blob';
	console.log('Getting file');
    request.onload = function() {
        var reader = new FileReader();

        reader.onload = parseData;
        reader.readAsText(request.response);
    };
    request.send();

}