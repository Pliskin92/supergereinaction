FROM nginx:alpine

# Patch the base image's OS packages before copying anything in.
#
# nginx:alpine lags Alpine's own security updates -- at the time of writing
# it ships libuuid 2.42.1-r0 against 7 HIGH util-linux CVEs that Alpine
# fixed in 2.42.3-r1 -- and the CI vulnerability scan (severity
# CRITICAL,HIGH, exit-code 1) fails the build on exactly those. Pulling a
# newer base tag does not help: the newest nginx:alpine still carries the
# vulnerable version, so the packages have to be upgraded here.
#
# `apk upgrade` rather than pinning individual packages: pinning would fix
# this week's CVE list and go stale the moment the next one lands, leaving
# the build red again for a reason nobody remembers. This takes whatever
# Alpine currently considers current, which is what the scanner checks
# against.
#
# --no-cache leaves no package index behind, so the layer adds only the
# upgraded packages themselves.
RUN apk upgrade --no-cache

# Serving rules: long-lived caching for art, no caching for the pages.
# Without this nginx sends `cache-control: private` on everything and the
# browser revalidates all 102 spritesheets on every visit.
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY web/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s \
  CMD wget -qO- http://localhost/index.html >/dev/null || exit 1
