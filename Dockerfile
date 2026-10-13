FROM nginx:stable-alpine3.24

RUN apk add --no-cache bash \
 && mkdir -p /usr/share/nginx/html \
 && chmod -R a+rwX /usr/share/nginx/html

# config minimale: ascolta su 8080 su tutte le interfacce
COPY --chmod=644 nginx.conf /etc/nginx/nginx.conf.tpl

# i tuoi file statici
COPY index.html index.js styles.css /usr/share/nginx/html/
