function writeContent(fileUrl, file, title, authors) {
    addStandardPreviewHeader(file, title, authors);
    options = {
        "stripIgnoreTag": true,
        "stripIgnoreTagBody": ['script', 'head']
    };  // Custom rules
    var request = new XMLHttpRequest();

    zipUrl=fileUrl;
//    console.log('About to Get ' + fileUrl + '&zipentry=project.qde');
//     request.open('GET', fileUrl + '&zipentry=project.qde', true);
//    request.responseType = 'blob';
//      console.log('Getting file');
//    request.onload = function() {
//        var reader = new FileReader();

//        reader.onload = parseData;
//        reader.readAsText(request.response);
//    };
//    request.send();
readZip(fileUrl);
}


const MAX_ENTRIES_EXPANDED = 2000;
let entries;
const entryMap = {};

async function readZip(fileUrl) {

    try {
        //Just a workaround, as current Dataverse delivers https links for localhost
        if (fileUrl.startsWith('https://localhost')) {
            fileUrl = fileUrl.replace('https://localhost', 'http://localhost');
        }


        const reader = new zip.ZipReader(new zip.HttpRangeReader(fileUrl, ));

        // get all entries from the zip
        entries = await reader.getEntries();
        if (entries.length) {

            entries.forEach(function(entry, index) {
                let filename = entry.filename;

              if (filename === 'project.qde') {

                var projectBlob = entry.getData(new zip.TextWriter(), {
                  onprogress: (index, max) => {

                    const percent = Math.round(index / max * 100);
                    console.log(index + "   " + max + "   " + percent);
                    setProgressBarValue(percent);

                  },
                });
                projectBlob.then(text => parseData(text));
              }
              else if (!entry.directory) {
                 entryMap[entry.filename] = index;
              }
            });
        }

            // close the ZipReader
            await reader.close();

    }
    catch (err) {
        //Display error message
        const errorMsg = document.createTextNode("Zip file structure could not be read (" + err + "). You can still download the zip file.");
//        document.getElementById('zip-preview').appendChild(errorMsg);
        console.log(err);


    }
    finally {
        //remove throbber
        const throbber = document.getElementById("throbber");
        if (throbber)
            throbber.parentNode.removeChild(throbber);
    }
}

async function downloadFile(event) {
    const target = event.currentTarget;
    let href = target.getAttribute("href");
    //Check - retrieve blob the first time only
    if (target.dataset.entryIndex !== undefined && !target.download) {
            console.log('Downloading');
        target.removeAttribute("href");
        event.preventDefault();
        try {
            await download(entries[Number(target.dataset.entryIndex)], target.parentElement, target);
            href = target.getAttribute("href");
        } catch (error) {
            alert(error);
        }
        target.setAttribute("href", href);
    }
}

async function download(entry, li, a) {
    if (!li.classList.contains("busy")) {

        const controller = new AbortController();
        const signal = controller.signal;

        li.classList.add("busy");
        try {
            const blobURL = URL.createObjectURL(await entry.getData(new zip.BlobWriter(), {
                onprogress: (index, max) => {

                    const percent = Math.round(index/max*100);
                    console.log(index + "   " + max  + "   " + percent);
                    //setProgressBarValue(percent);

                },
            }))
            var index = a.getAttribute("data-entry-index");
            //Set href and download on all nodes with the same index
            $("a[data-entry-index='" + index + "']").attr('href',blobURL);
             $("a[data-entry-index='" + index + "']").attr('download',a.text);
            const clickEvent = new MouseEvent("click");
            a.dispatchEvent(clickEvent);
        } catch (error) {
            if (error.message != zip.ERR_ABORT) {
                throw error;
            }
        } finally {
            li.classList.remove("busy");
//            setProgressBarValue(0);
        }
    }
}
