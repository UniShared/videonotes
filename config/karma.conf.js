basePath = '../';

files = [
    JASMINE,
    JASMINE_ADAPTER,
    'test/lib/jasmine-jquery/jasmine-jquery.js',
    'test/lib/jquery/jquery-1.9.1.js',
    'static/lib/angular/angular.js',
    'test/lib/angular/angular-mocks.js',
    'test/lib/google/*.js',
    'static/lib/popcorn/popcorn-complete.js',
    'static/lib/**/*.js',
    'static/js/app.js',
    'static/js/controllers.js',
    'static/js/directives.js',
    'static/js/filters.js',
    'static/js/services.js',
    'test/unit/**/servicesSpec.js',
    'test/unit/**/controllersSpec.js',
    'test/unit/**/directivesSpec.js',
    'test/unit/**/filtersSpec.js'
];

autoWatch = true;

browsers = ['Chrome'];

junitReporter = {
    outputFile: 'test_out/unit.xml',
    suite: 'unit'
};
