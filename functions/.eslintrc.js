module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'google',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json', 'tsconfig.dev.json'],
    sourceType: 'module',
  },
  ignorePatterns: [
    '/lib/**/*', // Ignore built files.
    '/generated/**/*', // Ignore generated files.
  ],
  plugins: [
    '@typescript-eslint',
    'import',
  ],
  rules: {
    'quotes': ['error'],
    'import/no-unresolved': 0,
    'indent': 'off',
    'no-multi-spaces': 'off',
    'operator-linebreak': 'off',
    'valid-jsdoc': 'off',
    'require-jsdoc': 'off',
    'max-len': ['error', {'code': 150}],
    'linebreak-style': 0,
    '@typescript-eslint/no-explicit-any': 'off',
    'arrow-parens': 'off',
    'comma-dangle': 'off',
    'no-multiple-empty-lines': 'off'
  },
};
