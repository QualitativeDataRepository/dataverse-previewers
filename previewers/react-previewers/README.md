# React-Previewers

This directory holds all the previewers provided in React automatically. Given a source code in the `react-source` directory, one can integrate a React previewer by attaching a `previewer-meta.yml` file which includes name and instructions to build the previewer.

Here is an example for the `HDF5-Previewer`

```yaml
name: HDF5-Previewer
checkdir: ./src
checksum: null
build:
- npm install
- npm run build
files:
- ./dist/hdf5.js
- ./dist/hdf5.css
- ./dist/HDF5Preview.html
```

## YAML schema

* **name**: Name of the previewer. This will also be the lower-case directory name of the build found in `react-previewers`
* **checkdir**: Directory from which the checksum needs to be calculated to detect changes. This is necessary, because upon `npm install` and building IDs are generate which alter the general checksum.
* **checksum**: SHA256 hash of the `checkdir` to detect changes within the source code. This is done to prevent redundant builds when nothing has changed.
* **build**: List of commands to build this app.
* **files**: Resulting build files that are copied to `react-previewers`