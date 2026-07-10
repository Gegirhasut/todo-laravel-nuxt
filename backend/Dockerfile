# 8.2 is the platform floor stated in the ТЗ and DECISIONS.md — the image
# tracks it so "works on 8.2" is actually exercised, not just claimed.
FROM php:8.2-cli

RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libzip-dev libsqlite3-dev \
    && docker-php-ext-install pdo pdo_sqlite zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Install the dependencies first so this layer is cached across code changes.
COPY composer.json composer.lock ./
RUN composer install --no-interaction --prefer-dist --no-progress --no-scripts --no-autoloader

COPY . /app
RUN composer dump-autoload --optimize \
    && php artisan package:discover --ansi \
    && chmod -R 777 storage bootstrap/cache

# The SQLite file lives on a volume so it survives a container restart.
ENV DB_CONNECTION=sqlite
ENV DB_DATABASE=/data/database.sqlite

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
