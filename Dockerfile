FROM nginx:stable-alpine3.24

# hadolint ignore=DL3018
RUN apk add --no-cache bash \
 && mkdir -p /usr/share/nginx/html \
 && chmod -R a+rwX /usr/share/nginx/html

COPY --chmod=644 nginx.conf /etc/nginx/nginx.conf.tpl
COPY index.html index.js styles.css /usr/share/nginx/html/
