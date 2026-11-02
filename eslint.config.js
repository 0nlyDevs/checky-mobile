// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // phosphor-react-native only declares import/require conditions in "exports"; the resolver
    // finds no "default" condition, though Metro (react-native field) and tsc resolve it.
    rules: { 'import/no-unresolved': ['error', { ignore: ['^phosphor-react-native$'] }] },
  },
]);
