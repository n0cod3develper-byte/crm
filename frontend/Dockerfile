FROM nginx:alpine

# Copiar configuracion personalizada de Nginx para soporte SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html/
COPY dist .

CMD ["nginx", "-g", "daemon off;"]
