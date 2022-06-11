<?php
/**
 * Plugin Name: WP Test
 */

defined( 'ABSPATH' ) || die();

add_action( 'init', function() {
    add_action( 'test_action', function( &$wp_version) {
        $wp_version = get_bloginfo( 'version' );
    } );
} );
