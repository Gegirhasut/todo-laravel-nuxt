#!/bin/sh
set -e

# `php artisan serve` only passes a small whitelist of environment variables
# through to the php -S worker it spawns, so anything compose sets has to end
# up in .env to reach the running app.
upsert_env() {
    key="$1"
    value="$2"

    [ -z "$value" ] && return 0

    if grep -q "^${key}=" .env; then
        sed -i "s|^${key}=.*|${key}=${value}|" .env
    else
        printf '%s=%s\n' "$key" "$value" >> .env
    fi
}

# First run inside the container: no .env yet, and no application key.
[ -f .env ] || cp .env.example .env
grep -q '^APP_KEY=.\+' .env || php artisan key:generate --force

for key in APP_ENV APP_DEBUG APP_URL DB_CONNECTION DB_DATABASE CORS_ALLOWED_ORIGINS SANCTUM_TOKEN_EXPIRATION; do
    eval "value=\${$key:-}"
    upsert_env "$key" "$value"
done

mkdir -p "$(dirname "$DB_DATABASE")"
touch "$DB_DATABASE"

php artisan migrate --force --seed

exec "$@"
