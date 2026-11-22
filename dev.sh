#!/usr/bin/env bash
# Development server: serves the files in ./html directly from the host,
# so edits are visible on browser reload without rebuilding the image.
set -euo pipefail
cd "$(dirname "$0")"

IMAGE="${IMAGE:-generefine:1.0.0}"
NAME="${NAME:-gxdev}"
PORT="${PORT:-8080}"
HTML_DIR="${HTML_DIR:-./}"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Image '$IMAGE' not found. Build it once with: docker build -t $IMAGE ." >&2
  exit 1
fi

# Mount every top-level entry of the html dir separately: the container
# creates the input*.tsv symlinks in /usr/share/nginx/html, so the whole
# directory cannot be mounted read-only.
mounts=()
for f in "$HTML_DIR"/*; do
  name="$(basename "$f")"
  case "$name" in input*.tsv) continue ;; esac
  mounts+=(-v "$PWD/$f:/usr/share/nginx/html/$name:ro,z")
done

# Optional: also use the local nginx config template (needs a restart to apply)
if [ -f nginx.conf ]; then
  mounts+=(-v "$PWD/nginx.conf:/etc/nginx/nginx.conf.tpl:ro,z")
fi

docker rm -f "$NAME" >/dev/null 2>&1 || true

echo "Serving on http://localhost:$PORT/  (Ctrl+C to stop)"
exec docker run --rm -it --name "$NAME" -p "$PORT:8080" -u "$(id -u)" \
  -v "$PWD/example_data:/gx:z" \
  "${mounts[@]}" \
  --entrypoint bash "$IMAGE" -c '
OUT=/gx/output.tsv
HOM_FILENAME=hom_filename.tsv
HET_FILENAME=het_filename.tsv
COMP_FILENAME=comp_filename.tsv
ln -s /gx/hom_file.tsv /usr/share/nginx/html/input1.tsv
ln -s /gx/het_file.tsv /usr/share/nginx/html/input2.tsv
mkdir -p "$(dirname $OUT)/.nginx_tmp"
mkdir -p /tmp/state
for file_name in hom_state het_state comp_state; do
  echo "{\"state\": {}, \"notes\": {}}" > "/tmp/state/${file_name}.json"
done
echo "{\"0\": \"$HOM_FILENAME\", \"1\": \"$HET_FILENAME\", \"2\": \"$COMP_FILENAME\" }" > "/tmp/state/user_file_names.json"
sed -e "s|__OUT__|$OUT|g" -e "s|__OUTDIR__|$(dirname $OUT)|g" /etc/nginx/nginx.conf.tpl > /tmp/nginx.conf
nginx -c /tmp/nginx.conf -g "daemon off;"'