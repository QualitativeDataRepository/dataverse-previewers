function writeContent(fileUrl, file, title, authors) {
    addStandardPreviewHeader(file, title, authors);
    options = {
        "stripIgnoreTag": true,
        "stripIgnoreTagBody": ['script', 'head']
    };  // Custom rules
        fetch(fileUrl)
  .then(response => response.text())
  .then(data => parseData(data));
}
