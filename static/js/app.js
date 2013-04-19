'use strict';

var EditorState = {
    CLEAN: 0, // NO CHANGES
    DIRTY: 1, // UNSAVED CHANGES
    SAVE: 2, // SAVE IN PROGRESS
    LOAD: 3, // LOADING
    READONLY: 4
};

var Actions = {
    LOAD: "load",
    CREATE: "create"
};

//first, checks if it isn't implemented yet
if (!String.prototype.format) {
    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined'
                ? args[number]
                : match
                ;
        });
    };
}

google.load('picker', '1');
gapi.load('drive-share');

angular.module('app', ['app.controllers', 'app.filters', 'app.services', 'app.directives', 'ui.keypress', 'ui.bootstrap', 'analytics', 'youtube'])
    .constant('appName', 'VideoNot.es')
    .constant('saveInterval', 15000)
    .constant('sampleVideo', 'http://www.youtube.com/watch?v=zDZFcDGpL4U') // Please replace this with your Application ID.
    .config(['$routeProvider', function ($routeProvider) {
        $routeProvider
            .when('/', {templateUrl: '/partials/home.html', controller: "HomeCtrl"})
            .when('/edit/', {templateUrl: '/partials/editor.html', controller: 'MainCtrl', action: Actions.CREATE})
            .when('/edit/:id', {templateUrl: '/partials/editor.html', controller: 'MainCtrl', action: Actions.LOAD})
            .otherwise({redirectTo: '/'});
    }])
    .config(['$tooltipProvider', function ($tooltipProvider) {
        $tooltipProvider.options( { appendToBody: true } );
    }])
    .run(['$rootScope', function ($rootScope) {
        // Many events binding
        $rootScope.$onMany = function (events, fn) {
            for (var i = 0; i < events.length; i++) {
                this.$on(events[i], fn);
            }
        };
    }]);
