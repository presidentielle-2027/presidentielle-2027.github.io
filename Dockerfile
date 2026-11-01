FROM nginxinc/nginx-unprivileged:stable-alpine
COPY --chown=101:101 deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=101:101 dist/ /usr/share/nginx/html/
EXPOSE 8080
