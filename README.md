# GeneRefine

Galaxy Interactive Tool to visualize, filter and annotate genetic variant files in a tabular format.

After a variant calling and annotation pipeline, researchers and clinical geneticists are left with large tabular files containing thousands of variants. Reviewing them usually means exporting the tables from the analysis platform and working on them in spreadsheets or ad-hoc scripts, which is slow, error-prone and hard to reproduce.

GeneRefine brings this review step directly inside Galaxy. It lets users explore homozygous, heterozygous and compound heterozygous variants side by side, filter them interactively, annotate the rows of interest and save the result as a new tabular dataset in the Galaxy history. Filter configurations can be exported and imported, so the same criteria can be applied consistently across samples and shared with colleagues.

**Intended users:** bioinformaticians, clinical geneticists and researchers who need to prioritize and curate variants without leaving their Galaxy workflow.

## Features

* **Three input TSV files:** load up to three tables of variants and manage each one separately:
  * homozygous variants (HOM sheet)
  * heterozygous variants (HET sheet)
  * compound heterozygous variants (COMP sheet)
* **Synchronized columns:** the column layout (visibility, order, width) is shared across the three files, so changing it in one table is reflected in the others.
* **Independent filters:** filters are applied separately to each file.
* **Import/export of filters:** filter configurations can be exported and imported again, so they can be saved and reused across sessions.
* **Annotation and export:** add notes to the variants and export them from all three files as a single tabular output, with the extra columns `Notes` and `GTYPE`.

## Usage

1. **Launch the tool** from the Galaxy tool panel and select the input files: homozygous, heterozygous and compound heterozygous variants. Wait for the tool to start, then open it from the Interactive Tools page.
2. **Switch between the three tables** using the tabs at the top. Each file is managed separately.
3. **Arrange the columns** (show, hide, reorder, resize). The column layout is synchronized across the three tables, so you only need to set it up once.
4. **Apply filters** on any column. Filters are independent for each table, so you can use different criteria for homozygous, heterozygous and compound heterozygous variants.
   Filters can be saved and reused: use **Export → Export filters** to download the current configuration of the active sheet as a JSON file, and **Import → Import filters** to load a previously saved one.
5. **Annotate variants** by writing free-text comments in the `Notes` column.
6. **Select variants** (optional) using the checkbox on the left of each row.
7. **Export the results** with the **Export** button:
   * **Export → TSV (all rows)** exports all the variants currently displayed, i.e. matching the active filters.
   * **Export → TSV (only selected)** exports only the rows selected with the checkbox.
8. **Close the tool.** After the export, stop the interactive tool to have the result saved as a new dataset in your Galaxy history.

### Output

The output is a single tab-separated file that merges the variants from all three input files. Two columns are added to the original ones:

| Column  | Description |
|---------|-------------|
| `Notes` | Free-text annotation entered by the user for each variant |
| `GTYPE` | Origin of the variant, i.e. the sheet it comes from: `HOM` (homozygous), `HET` (heterozygous) or `COMP` (compound heterozygous) |



## Architecture

* **Backend:** Nginx
* **Frontend:** JS library [`ag-grid-community`](https://www.ag-grid.com/)

## How to add the tool in Galaxy

The file `interactivetool_generefine.sample.xml` contains the configuration required to integrate the application into Galaxy.
Before using it, update the container image reference so that it points to your private registry.

## Local execution

The `example_data` folder contains sample files you can use to try the application locally.

Build the Docker image using the included Dockerfile:

```bash
docker build -t generefine .
```

Run the container as your user (mount a different folder if you want to load your own files) :

```bash
docker run -d --name gxtest -p 8080:8080 -u "$(id -u)" \
	-v ./example_data:/gx:z --entrypoint bash generefine -c '
OUT=/gx/output.tsv
ln -s /gx/hom_file.tsv /usr/share/nginx/html/input1.tsv;
ln -s /gx/het_file.tsv /usr/share/nginx/html/input2.tsv;
mkdir -p "$(dirname $OUT)/.nginx_tmp" ;
sed -e "s|__OUT__|$OUT|g" -e "s|__OUTDIR__|$(dirname $OUT)|g" /etc/nginx/nginx.conf.tpl > /tmp/nginx.conf ;
nginx -c /tmp/nginx.conf -g "daemon off;"'
```

Now you can access the application at http://localhost:8080/

## Credits and references

* **Galaxy:** The Galaxy Community. *The Galaxy platform for accessible, reproducible, and collaborative data analyses: 2024 update.* Nucleic Acids Research, 52(W1), W83–W94, 2024. https://doi.org/10.1093/nar/gkae410
* **Galaxy Interactive Tools:** [documentation](https://training.galaxyproject.org/training-material/topics/dev/tutorials/interactive-tools/tutorial.html)
* **AG Grid Community:** [ag-grid.com](https://www.ag-grid.com/), distributed under the MIT License.
* **Nginx:** [nginx.org](https://nginx.org/), used as the web server.