var queryParams = null;
var datasetUrl = null;
var version = null;
var fileDownloadUrl = null;
var previewMode = null;

function startPreview(retrieveFile) {
    // Retrieve tool launch parameters from URL
    queryParams = new URLSearchParams(window.location.search.substring(1));
    var fileUrl = queryParams.get("siteUrl") + "/api/access/datafile/" +
        queryParams.get("fileid") + "?gbrecs=true";
    fileDownloadUrl = queryParams.get("siteUrl") + "/api/access/datafile/" +
        queryParams.get("fileid") + "?gbrecs=false";
    var versionUrl = queryParams.get("siteUrl") + "/api/datasets/" +
        queryParams.get("datasetid") + "/versions/" +
        queryParams.get("datasetversion");
    var apiKey = queryParams.get("key");
    // Hide header and citation to embed on Dataverse file landing page.
    previewMode = queryParams.get("preview");
    if (apiKey != null) {
        fileUrl = fileUrl + "&key=" + apiKey;
        versionUrl = versionUrl + "?key=" + apiKey;
    }

    if (inIframe()) {
        callPreviewerScript(retrieveFile, {}, '', '');
    } else {
        // Get metadata for dataset/version/file
        $.ajax({
                    dataType: "json",
                    url: versionUrl,
                    // headers: { 'X-Dataverse-key': apiKey },
                    crossite: true,
                    success: function(json, status) {
                        var mdFields = json.data.metadataBlocks.citation.fields;

                        var title = "";
                        var authors = "";
                        datasetUrl = json.data.storageIdentifier;
                        datasetUrl = datasetUrl
                            .substring(datasetUrl.indexOf("//") + 2);
                        version = queryParams.get("datasetversion");
                        if (version === ":draft") {
                            version = "DRAFT";
                        }

                        for (var field in mdFields) {
                            if (mdFields[field].typeName === "title") {
                                title = mdFields[field].value;
                            }
                            if (mdFields[field].typeName === "author") {
                                var authorFields = mdFields[field].value;
                                for (var author in authorFields) {
                                    if (authors.length > 0) {
                                        authors = authors + "; ";
                                    }
                                    authors = authors +
                                        authorFields[author].authorName.value;
                                }
                            }
                        }
                        var datafiles = json.data.files;
                        var fileIndex = 0;
                        for (var entry in datafiles) {
                            if (JSON.stringify(datafiles[entry].dataFile.id) === queryParams
                                .get("fileid")) {
                                fileIndex = entry;
                                callPreviewerScript(retrieveFile, fileUrl, datafiles[fileIndex].dataFile, title, authors);
                                }
                            }
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            reportFailure("Unable to retrieve metadata.", textStatus);

                        }
                    });
            }
    }

    function inIframe() {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    }

    function callPreviewerScript(retrieveFile, fileUrl, fileMetadata, title, authors) {
        if (retrieveFile) {
            $.ajax({
                type: 'GET',
                dataType: 'text',
                // headers: { 'X-Dataverse-key': apiKey},
                crosssite: true,
                url: fileUrl,
                success: function(data, status) {
                    writeContentAndData(data, fileUrl,
                        fileMetadata,
                        title, authors);
                },
                error: function(request, status, error) {
                    reportFailure(
                        "Unable to retrieve file.",
                        status);
                }
            });

        } else {
            writeContent(fileUrl,
                fileMetadata, title,
                authors);
        }
    }

    var filePageUrl = null;

    function addStandardPreviewHeader(file, title, authors) {
        if (previewMode !== 'true') {
            // Add favicon from source Dataverse
            $('head')
                .append(
                    $('<link/>')
                    .attr('sizes', '180x180')
                    .attr('rel', 'apple-touch-icon')
                    .attr(
                        'href',
                        queryParams.get("siteUrl") +
                        '/javax.faces.resource/images/fav/apple-touch-icon.png.xhtml'))
                .append(
                    $('<link/>')
                    .attr('type', 'image/png')
                    .attr('sizes', '16x16')
                    .attr('rel', 'icon')
                    .attr(
                        'href',
                        queryParams.get("siteUrl") +
                        '/javax.faces.resource/images/fav/favicon-16x16.png.xhtml'))
                .append(
                    $('<link/>')
                    .attr('type', 'image/png')
                    .attr('sizes', '32x32')
                    .attr('rel', 'icon')
                    .attr(
                        'href',
                        queryParams.get("siteUrl") +
                        '/javax.faces.resource/images/fav/favicon-32x32.png.xhtml'))

                .append(
                    $('<link/>')
                    .attr('rel', 'manifest')
                    .attr(
                        'href',
                        queryParams.get("siteUrl") +
                        '/javax.faces.resource/images/site.webmanifest.xhtml'))

                .append(
                    $('<link/>')
                    .attr('color', '#da532c')
                    .attr('rel', 'mask-icon')
                    .attr(
                        'href',
                        queryParams.get("siteUrl") +
                        '/javax.faces.resource/images/fav/safari-pinned-tab.svg.xhtml'))
                .append(
                    $('<meta/>')
                    .attr('content', '#da532c')
                    .attr('name', 'msapplication-TileColor'))
                .append(
                    $('<meta/>')
                    .attr('content', '#ffffff')
                    .attr('name', 'theme-color'));

            // Add logo from source Dataverse or use a local one, unless we are in preview mode
            $('#logo')
                .attr('src', queryParams.get("siteUrl") + '/logos/preview_logo.png')
                .attr(
                    'onerror',
                    'this.onerror=null;this.src="/dataverse-previewers/previewers/images/logo_placeholder.png";');
        }
        //Footer
        $('body').append($('<div/>').html("Previewers originally developed by <a href='https://qdr.syr.edu'>QDR</a> and maintained at <a href='https://github.com/QualitativeDataRepository/dataverse-previewers'>https://github.com/QualitativeDataRepository/dataverse-previewers</a>. Feedback and contributions welcome.").attr('id', 'footer'));

        if (previewMode !== 'true') {
            options = {
                "stripIgnoreTag": true,
                "stripIgnoreTagBody": ['script', 'head']
            }; // Custom rules
            filePageUrl = queryParams.get("siteUrl") + "/file.xhtml?";
            if (file.persistentId.length == 0) {
                filePageUrl = filePageUrl + "fileId=" + file.id;
            } else {
                filePageUrl = filePageUrl + "persistentId=" + file.persistentId;
            }
            filePageUrl = filePageUrl + "&version=" + version;
            var header = $('.preview-header').append($('<div/>'));
            header.append($("<div/>").text("Filename: ").append(
                $('<a/>').attr('href', filePageUrl).text(file.filename)).attr('id',
                'filename'));
            if ((file.description != null) && (file.description.length > 0)) {
                header.append($('<div/>').html(filterXSS("Description: " + file.description), options));
            }
            header.append($('<div/>').text("In ").append(
                $('<span/>').attr('id', 'dataset').append(
                    $('<a/>').attr(
                        'href',
                        queryParams.get("siteUrl") +
                        "/dataset.xhtml?persistentId=doi:" +
                        datasetUrl + "&version=" + version).text(
                        title))).append(
                $('<span/>').text(" (version " + version + ")").attr('id',
                    'version')).append(
                $('<span/>').text(", by " + authors).attr('id', 'authors')));
            header.append($("<div/>").addClass("btn btn-default").html(
                "<a href='" + fileDownloadUrl + "'>Download File</a>"));
            header.append($("<div/>").addClass("btn btn-default").html(
                "<a href=\"javascript:window.close();\">Close Preview</a>"));
            if (file.creationDate != null) {
                header.append($("<div/>").addClass("preview-note").text(
                    "File uploaded on " + file.creationDate));
            }
        }
        if (previewMode === 'true') {
            $('#logo').hide();
            $('.page-title').hide();
            $('.preview-header').hide();
        }
    }

    function reportFailure(msg, statusCode) {
        var preview = $(".preview");
        preview.addClass("alert alert-danger");
        preview
            .text(msg +
                "Please try again. The most common issue is that your login has timed out. If the problem persists, please contact the support team of this data repository. Please include any status code included at the end of this message: " +
                statusCode);
    }