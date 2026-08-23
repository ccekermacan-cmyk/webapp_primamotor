FROM php:8.3-cli-alpine

# Install system dependencies & PHP extensions
RUN apk add --no-cache \
    sqlite-libs \
    sqlite-dev \
    libpng-dev \
    libzip-dev \
    zip \
    unzip \
    git \
    curl \
    && docker-php-ext-install pdo pdo_sqlite pdo_mysql bcmath zip

WORKDIR /var/www/html

# Copy application files
COPY . /var/www/html

# Set permissions for Laravel storage and bootstrap/cache
RUN chmod -R 777 storage bootstrap/cache

EXPOSE 8000

# Run Laravel artisan serve on port 8000
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
