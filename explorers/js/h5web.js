const destination = 'https://h5web.panosc.eu/h5wasm?url=';
const file_api_uri = 'https://edmond.mpdl.mpg.de/api/access/datafile/';
window.onload = () => {
    const params = new URLSearchParams(window.location.search);
      if (params.has('id')) {
        const id = params.get('id');
        if (id) {
            const url_param = file_api_uri.concat(id);
            displayMessage('redirecting ...');
            location.href = destination.concat(url_param);
        } else {
            displayMessage('query param \'id\' has no value!');
        }
      } else {
        displayMessage('query param \'id\' is missing!');
      }
}

displayMessage = (msg) => {
    document.getElementById('msg').innerHTML = msg;
}