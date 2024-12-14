import MyrotvoretsConfig from '@myrotvorets/eslint-config-myrotvorets-ts';

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        ignores: ['**/*.js', '**/*.d.ts', 'dist/**', 'lib/**'],
    },
    ...MyrotvoretsConfig,
];
