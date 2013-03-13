basePath = '../';

files = [
    JASMINE,
    JASMINE_ADAPTER,
    'test/lib/angular/angular.js',
    'test/lib/angular/angular-mocks.js',
    'test/lib/google/jsapi.js',
    'static/lib/**/*.js',
    'static/js/**/*.js',
    'test/unit/**/servicesSpec.js',
    'test/unit/**/controllersSpec.js'
];

autoWatch = true;

browsers = ['Chrome'];

junitReporter = {
    outputFile: 'test_out/unit.xml',
    suite: 'unit'
};
