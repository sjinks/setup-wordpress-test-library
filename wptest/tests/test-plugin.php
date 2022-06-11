<?php

class Test_Plugin extends WP_UnitTestCase {
    public function test_basic(): void {
        self::assertTrue( has_action( 'test_action' ) );
    }

    public function test_action(): void {
        $before = did_action( 'test_action' );
        $ver    = null;

        do_action_ref_array( 'test_action', [ &$ver ] );
        $after = did_action( 'test_action' );

        self::assertGreaterThan( $before, $after );
        self::assertNotEmpty( $ver );
    }
}
