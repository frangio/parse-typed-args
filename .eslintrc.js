module.exports = {
  env: {
    es6: true,
  },
  extends: [
    'airbnb-base',
    'plugin:@typescript-eslint/recommended',
    'plugin:ava/recommended',
    'plugin:prettier/recommended',
    'prettier/@typescript-eslint',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
    'ava',
  ],
  rules: {
    'import/prefer-default-export': 'off',
    'import/no-extraneous-dependencies': ['error', {
      devDependencies: [ '**/*.test.{js,ts}' ],
      optionalDependencies: false,
    }],
  },
  settings: {
    'import/resolver': {
      'node': {
        'extensions': ['.js', '.ts'],
      },
    },
  }
};
