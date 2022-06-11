# setup-wordpress-test-library

This action sets up WordPress and WordPress Test Library. WordPress plugins can make use of this action to run unit tests.

## Inputs

  * `version`: WordPress version to use. Can be `trunk` or `nightly` for the latest nightly build, `latest` for the latest available WordPress release, an explicit version number (like `6.0`) to install the specific WordPress version, or a partial version (`5.9.x`) to install the latest available patch for the specific WordPress release. The default value is `latest`.
  * `cache`: whether to use cached WordPress and WordPress Test Library. The default value is `true`. Nightly releases are never cached;
  * `dir`: target directory for WordPress and WordPress Test Library; the default value is `/tmp`. **Warning:** the system will delete `wordpress`, `wordpress-test-library`, and `wordpress.zip` from that directory if they exist.
  * `db_user`: database user for WordPress, `root` by default;
  * `db_password`: database password for WordPress, empty by default;
  * `db_name`: database name for WordPress, `wordpress_test` by default. **Warning:** WordPress Test Library may delete all tables from that database;
  * `db_host`: database host (`localhost` by default) for WordPress.

## Outputs

  * `wp_version`: the actual WordPress version.

## Example usage

TBD.
