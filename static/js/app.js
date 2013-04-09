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
    String.prototype.format = function() {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] != 'undefined'
                ? args[number]
                : match
                ;
        });
    };
}

google.load('picker', '1');
//gapi.load('drive-share');

angular.module('app', ['app.filters', 'app.services', 'app.directives', 'ui.directives', 'analytics', 'youtube'])
    .constant('appName', 'VideoNot.es')
    .constant('saveInterval', 15000)
    .constant('appId', '653335932456-b0rsc2sq9ftn5l69p72710lh4n8tujtr.apps.googleusercontent.com') // Please replace this with your Application ID.
    .constant('sampleVideo', 'http://www.youtube.com/watch?v=zDZFcDGpL4U') // Please replace this with your Application ID.
    .config(['$routeProvider', function ($routeProvider) {
        $routeProvider
            .when('/edit/', {action: Actions.CREATE})
            .when('/edit/:id', {action: Actions.LOAD})
            .otherwise({redirectTo: '/edit/'});
    }]).run(['$rootScope', function ($rootScope) {
        // Many events binding
        $rootScope.$onMany = function (events, fn) {
            for (var i = 0; i < events.length; i++) {
                this.$on(events[i], fn);
            }
        };
    }]).run(['$rootScope', 'config', 'appName', function($rootScope, config, appName) {
        var configData = {appName: appName};

        config.load().then(function (response) {
            $.extend(configData, response.data);
            $rootScope.$broadcast('configLoaded', configData);
        });
    }]);
