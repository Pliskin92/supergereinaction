FROM nginx:alpine

COPY web/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s \
  CMD wget -qO- http://localhost/index.html >/dev/null || exit 1
