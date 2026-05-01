function writeContent(fileUrl, file, title, authors) {
  addStandardPreviewHeader(file, title, authors);
  options = {
    "stripIgnoreTag": true,
    "stripIgnoreTagBody": ['script', 'head']
  };  // Custom rules
  wait = $('<div/>').attr('id', 'waiting');
  $('<img/>').width('15%').attr('src', 'images/Loading_icon.gif').attr('id', 'throbber').appendTo(wait);
  $('<span/>').text($.i18n('refiqdaRetrievingFile')).appendTo(wait);
  wait.appendTo($('.preview'));

  if (fileUrl.includes('auxiliary/qdpx')) {
    redactedMode = true;
  } else {
    redactedMode = false;
  }
  fetch(fileUrl)
    .then(response => response.text())
    .then(data => parseData(data, file));
}
