# Dockerfile unificado para EasyPanel
# Contiene: Frontend (Editor + Shell) + Agente Python

# ========================================
# Stage 1: Build Frontend
# ========================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app

# Copiar todo el proyecto
COPY . .

# Construir el renderer de Lit
WORKDIR /app/renderers/lit
RUN npm install
RUN mkdir -p src/0.8/schemas && cp ../../specification/0.8/json/*.json src/0.8/schemas/
RUN npm run build:tsc

# Construir el Editor
WORKDIR /app/tools/editor
RUN npm install
RUN npx vite build --outDir dist-static

# Construir el Shell
WORKDIR /app/samples/client/lit/shell
RUN npm install
RUN npx vite build --outDir dist-static

# ========================================
# Stage 2: Production Image
# ========================================
FROM python:3.13-slim

# Instalar nginx y supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    git \
    && rm -rf /var/lib/apt/lists/*

# Instalar uv para Python
RUN pip install uv

WORKDIR /app

# ----------------------------------------
# Configurar Python Agent
# ----------------------------------------
COPY a2a_agents/python/a2ui_extension /app/a2ui_extension
COPY samples/agent/adk/restaurant_finder /app/restaurant_finder

WORKDIR /app/a2ui_extension
RUN uv pip install --system -e .

WORKDIR /app/restaurant_finder
RUN uv pip install --system -e .

# ----------------------------------------
# Configurar Frontend
# ----------------------------------------
COPY --from=frontend-builder /app/tools/editor/dist-static /var/www/html/editor
COPY --from=frontend-builder /app/samples/client/lit/shell/dist-static /var/www/html/shell

# Crear pagina de inicio
RUN echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>A2UI</title><style>body{font-family:system-ui;max-width:600px;margin:50px auto;padding:20px}h1{color:#1a73e8}a{display:block;padding:15px;margin:10px 0;background:#f1f3f4;border-radius:8px;text-decoration:none;color:#202124}a:hover{background:#e8eaed}</style></head><body><h1>A2UI - Agent to User Interface</h1><p>Selecciona una aplicacion:</p><a href="/editor/">Editor - Genera UIs con Gemini</a><a href="/shell/">Shell - Chat con agentes A2A</a></body></html>' > /var/www/html/index.html

# ----------------------------------------
# Configurar Nginx
# ----------------------------------------
RUN rm /etc/nginx/sites-enabled/default
COPY <<EOF /etc/nginx/sites-available/a2ui
server {
    listen 80;
    server_name _;
    root /var/www/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /editor/ {
        alias /var/www/html/editor/;
        try_files \$uri \$uri/ /editor/index.html;
    }

    location /shell/ {
        alias /var/www/html/shell/;
        try_files \$uri \$uri/ /shell/index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:10002/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_buffering off;
        proxy_read_timeout 86400s;
    }
}
EOF
RUN ln -s /etc/nginx/sites-available/a2ui /etc/nginx/sites-enabled/

# ----------------------------------------
# Configurar Supervisor
# ----------------------------------------
COPY <<EOF /etc/supervisor/conf.d/a2ui.conf
[supervisord]
nodaemon=true
user=root

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:agent]
command=python __main__.py --host 0.0.0.0 --port 10002
directory=/app/restaurant_finder
environment=GEMINI_API_KEY="%(ENV_GEMINI_API_KEY)s"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF

# Puerto expuesto
EXPOSE 80

# Variables de entorno
ENV GEMINI_API_KEY=""

# Comando de inicio
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
