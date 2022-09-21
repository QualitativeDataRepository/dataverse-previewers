const destination = 'https://mybinder.org/v2/dataverse/';
window.onload = () => {
    const params = new URLSearchParams(window.location.search);
      if (params.has('doi')) {
        let doi = params.get('doi');
        if (doi) {
            doi = doi.substring(4);
            displayMessage('redirecting ...');
            location.href = destination + doi;
        } else {
            displayMessage('query param \'doi\' has no value!');
        }
      } else {
        displayMessage('query param \'doi\' is missing!');
      }
}

displayMessage = (msg) => {
    document.getElementById('msg').innerHTML = msg;
}