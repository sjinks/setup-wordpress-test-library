<?php

require_once __DIR__ . '/../vendor/autoload.php';

$_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( ! $_tests_dir ) {
	$_tests_dir = rtrim( sys_get_temp_dir(), '/\\' ) . '/wordpress-tests-lib';
}

if ( ! file_exists( $_tests_dir . '/includes/functions.php' ) ) {
	throw new Exception( "Could not find $_tests_dir/includes/functions.php" ); // NOSONAR
}

// Give access to tests_add_filter() function.
/** @psalm-suppress UnresolvableInclude */
require_once $_tests_dir . '/includes/functions.php';

function _manually_load_plugin(): void {
	require dirname( __DIR__ ) . '/plugin.php';
}

tests_add_filter( 'muplugins_loaded', '_manually_load_plugin' );

// Start up the WP testing environment.
/** @psalm-suppress UnresolvableInclude */
require $_tests_dir . '/includes/bootstrap.php';
