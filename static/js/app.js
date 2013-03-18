'use strict';

var EditorState = {
    CLEAN: 0, // NO CHANGES
    DIRTY: 1, // UNSAVED CHANGES
    SAVE: 2, // SAVE IN PROGRESS
    LOAD: 3, // LOADING
    READONLY: 4
};

google.load('picker', '1');
//gapi.load('drive-share');

angular.module('app', ['app.filters', 'app.services', 'app.directives', 'ui.directives', 'analytics', 'youtube'])
    .constant('saveInterval', 15000)
    .constant('appId', '653335932456-b0rsc2sq9ftn5l69p72710lh4n8tujtr.apps.googleusercontent.com') // Please replace this with your Application ID.
    .config(['$routeProvider', function ($routeProvider) {
        $routeProvider
            .when('/', {templateUrl: '/partials/editor.html', controller: MainCtrl})
            .when('/edit/', {templateUrl: '/partials/editor.html', controller: MainCtrl})
            .when('/edit/:id', {templateUrl: '/partials/editor.html', controller: MainCtrl})
            .otherwise({redirectTo: '/'});
    }]).run(function ($rootScope) {
        // Many events binding
        $rootScope.$onMany = function (events, fn) {
            for (var i = 0; i < events.length; i++) {
                this.$on(events[i], fn);
            }
        };
    });
