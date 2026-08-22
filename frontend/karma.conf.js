const os = require('os');
const path = require('path');

/**
 * Configures Karma to use an isolated, explicitly headless Chrome process.
 * The temporary profile prevents an existing interactive Chrome session from
 * blocking the test browser during local or CI runs.
 *
 * @param {import('karma').Config} config Karma configuration object.
 */
module.exports = function configureKarma(config) {
  const profileDirectory = path.join(os.tmpdir(), `tournament-manager-karma-${process.pid}`);

  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    reporters: ['progress'],
    browsers: ['ChromeHeadlessCI'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--headless=new',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-default-browser-check',
          `--user-data-dir=${profileDirectory}`,
        ],
      },
    },
    autoWatch: false,
    singleRun: true,
    restartOnFileChange: false,
    captureTimeout: 60000,
    browserDisconnectTolerance: 1,
    browserDisconnectTimeout: 10000,
    browserNoActivityTimeout: 60000,
    client: {
      clearContext: false,
    },
  });
};
