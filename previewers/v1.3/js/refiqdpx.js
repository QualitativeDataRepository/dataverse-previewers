function writeContent(fileUrl, file, title, authors) {
    addStandardPreviewHeader(file, title, authors);
    options = {
        "stripIgnoreTag": true,
        "stripIgnoreTagBody": ['script', 'head']
    };  // Custom rules
    var request = new XMLHttpRequest();
    
    zipUrl=fileUrl;
    console.log('About to Get ' + fileUrl + '&zipentry=project.qde');
     request.open('GET', fileUrl + '&zipentry=project.qde', true);
    request.responseType = 'blob';
	console.log('Getting file');
    request.onload = function() {
        var reader = new FileReader();

        reader.onload = parseData;
        reader.readAsText(request.response);
    };
    request.send();
}
