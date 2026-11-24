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
# Simulate Galaxy inputs
input1=/gx/hom_file.tsv
input2=/gx/het_file.tsv
input3=/gx/comp_file.tsv
input4=/gx/hom_filters.json
input5=/gx/het_filters.json
input6=/gx/comp_filters.json
out_file1=/gx/output.tsv

# Link inputs and outputs
link_names=(input1.tsv input2.tsv input3.tsv hom_filters.json het_filters.json comp_filters.json)
for ((i = 0; i < ${#link_names[@]}; i++)); do
  var="input$((i + 1))"
  src="${!var:-}"
  [ -f "$src" ] && ln -s "$src" "/usr/share/nginx/html/${link_names[i]}"
done

# Make server-side state files
mkdir -p "$(dirname $out_file1)/.nginx_tmp"
mkdir -p /tmp/state
for file_name in hom_state het_state comp_state; do
  echo "{\"state\": {}, \"notes\": {}}" > "/tmp/state/${file_name}.json"
done
echo "{\"0\": \"$(basename "$input1")\", \"1\": \"$(basename "$input2")\", \"2\": \"$(basename "$input3")\" }" > "/tmp/state/user_file_names.json"
sed -e "s|__OUT__|$out_file1|g" -e "s|__OUTDIR__|$(dirname $out_file1)|g" /etc/nginx/nginx.conf.tpl > /tmp/nginx.conf
nginx -c /tmp/nginx.conf -g "daemon off;"'