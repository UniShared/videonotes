basePath = '../';

files = [
    JASMINE,
    JASMINE_ADAPTER,
    // The dependencies
    'test/lib/jasmine-jquery/jasmine-jquery.js',
    'test/lib/jquery/jquery-1.9.1.js',
    'static/lib/angular/angular.js',
    'test/lib/angular/angular-mocks.js',
    'test/lib/google/*.js',
    'static/lib/ace/ace.min.js',
    'static/lib/angular-segmentio/angular-segmentio.js',
    'static/lib/angular-smoothscroll/dist/scripts/2d8e3100.scripts.js',
    'static/lib/angular-ui-bootstrap-custom/ui-bootstrap-custom-0.3.0.js',
    'static/lib/angular-ui-custom/angular-ui.js',
    'static/lib/bootstrap-switch/bootstrapSwitch.js',
    'static/lib/bootstrap-tour/bootstrap-tour.js',
    'static/lib/modernizr-custom/modernizr.min.js',
    'static/lib/detectizr/detectizr.js',
    'static/lib/es5-shim/es5-shim.js',
    'static/lib/es5-shim/es5-sham.js',
    'static/lib/linkedlist/linkedlist.js',
    'static/lib/popcorn/popcorn-complete.js',
    'static/lib/ui-utils-custom/ui-utils.js',

    // The app
    'static/js/app.js',
    'static/js/controllers.js',
    'static/js/directives.js',
    'static/js/filters.js',
    'static/js/services.js',

    // The specs
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
