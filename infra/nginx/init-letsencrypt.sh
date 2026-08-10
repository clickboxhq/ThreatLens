#!/usr/bin/env sh
# One-time bootstrap for the first Let's Encrypt certificate on a fresh VPS (§19.1, §19.5).
# Run from infra/: ./nginx/init-letsencrypt.sh
#
# Chicken-and-egg problem this works around: nginx's HTTPS server block needs a certificate
# to exist before it can start, but certbot's webroot method needs nginx already serving
# /.well-known/acme-challenge/ on port 80 to complete issuance. Standard fix: boot nginx with
# a short-lived self-signed "dummy" cert first, request the real one against that running
# nginx, then swap in the real cert and reload — no manual downtime step required after this.
set -eu

if [ -z "${DOMAIN:-}" ] || [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
  echo "Set DOMAIN and LETSENCRYPT_EMAIL (e.g. in ../.env.production) before running this." >&2
  exit 1
fi

COMPOSE="docker compose -f docker-compose.prod.yml --env-file ../.env.production"
LIVE_PATH="/etc/letsencrypt/live/${DOMAIN}"

echo "### Creating a dummy self-signed certificate for ${DOMAIN} so nginx can start ..."
$COMPOSE run --rm --entrypoint "sh -c \"\
  mkdir -p ${LIVE_PATH} && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout '${LIVE_PATH}/privkey.pem' \
    -out '${LIVE_PATH}/fullchain.pem' \
    -subj '/CN=localhost'\"" certbot

echo "### Starting nginx with the dummy certificate ..."
$COMPOSE up -d nginx

echo "### Deleting the dummy certificate ..."
$COMPOSE run --rm --entrypoint "sh -c \"rm -rf /etc/letsencrypt/live/${DOMAIN} /etc/letsencrypt/archive/${DOMAIN} /etc/letsencrypt/renewal/${DOMAIN}.conf\"" certbot

echo "### Requesting the real Let's Encrypt certificate ..."
$COMPOSE run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot \
  --email ${LETSENCRYPT_EMAIL} -d ${DOMAIN} --agree-tos --no-eff-email" certbot

echo "### Reloading nginx with the real certificate ..."
$COMPOSE exec nginx nginx -s reload

echo "### Done. ${DOMAIN} is now serving a real certificate; the certbot service will renew it automatically."
