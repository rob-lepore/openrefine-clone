# GeneRefine

Galaxy Interactive Tool to visualize, filter and annotate tabular files.

## Features

* Visualize, filter and annotate tabular files in the frontend using `ag-grid-community`.
* Load 2 or 3 input files directly from a Galaxy history.
* Write the output file directly to the same Galaxy history.

## Architecture

* **Backend:** Nginx (`nginx:stable-alpine3.24`).
* **Frontend:** Uses `ag-grid-community` for tabular data manipulation.
* **Container:** Dockerfile included to build the application image.

## Galaxy Integration

The file `interactivetool_generefine.sample.xml` contains the configuration required to integrate the application into Galaxy.

Before using it, update the container image reference to point to the correct application image.

## Build

Build the Docker image using the included Dockerfile:

```bash
docker build -t generefine .
```
