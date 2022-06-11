# setup-wordpress-test-library

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=sjinks_setup-wptl-action&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=sjinks_setup-wptl-action)
[![Build and Test](https://github.com/sjinks/setup-wptl-action/actions/workflows/ci.yml/badge.svg)](https://github.com/sjinks/setup-wptl-action/actions/workflows/ci.yml)
[![CodeQL Analysis](https://github.com/sjinks/setup-wptl-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/sjinks/setup-wptl-action/actions/workflows/codeql-analysis.yml)

This action sets up WordPress and WordPress Test Library. WordPress plugins can make use of this action to run unit tests.

## Inputs

  * `version`: WordPress version to use. Can be `trunk` or `nightly` for the latest nightly build, `latest` for the latest available WordPress release, an explicit version number (like `6.0`) to install the specific WordPress version, or a partial version (`5.9.x`) to install the latest available patch for the specific WordPress release. The default value is `latest`.
  * `dir`: target directory for WordPress and WordPress Test Library; the default value is `/tmp`. **Warning:** the system will delete `wordpress`, `wordpress-test-library`, and `wordpress.zip` from that directory if they exist.
  * `db_user`: database user for WordPress, `wordpress` by default;
  * `db_password`: database password for WordPress, `wordpress` by default;
  * `db_name`: database name for WordPress, `wordpress_test` by default. **Warning:** WordPress Test Library may delete all tables from that database;
  * `db_host`: database host (`127.0.0.1` by default) for WordPress.

## Outputs

  * `wp_version`: the actual WordPress version.

## Environment Variables

Upon success, the action sets the `WP_TESTS_DIR` environment variable; its value is the absolute path to the WordPress Test library

## Example usage

```yaml
name: CI

on:
  push:

permissions:
  contents: read

jobs:
  testing:
    name: Run tests
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mariadb:latest
        ports:
          - '3306:3306'
        env:
          MYSQL_ROOT_PASSWORD: wordpress
          MARIADB_INITDB_SKIP_TZINFO: 1
          MYSQL_USER: wordpress
          MYSQL_PASSWORD: wordpress
          MYSQL_DATABASE: wordpress_test
    steps:
      - name: Check out the source code
        uses: actions/checkout@v3

      - name: Set up PHP
        uses: shivammathur/setup-php@v2
        with:
          coverage: none
          php-version: "8.0"

      - name: Install PHP Dependencies
        uses: ramsey/composer-install@v2

      - name: Set up WordPress and WordPress Test Library
        uses: sjinks/setup-wordpress-test-library@master
        with:
          version: latest

      - name: Verify MariaDB connection
        run: |
          while ! mysqladmin ping -h 127.0.0.1 -P ${{ job.services.mysql.ports[3306] }} --silent; do
            sleep 1
          done
        timeout-minutes: 1

      - name: Run tests
        run: vendor/bin/phpunit
```
