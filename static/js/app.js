//Copyright (C) 2013 UniShared Inc.
//
//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

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

angular.module('app', ['app.controllers', 'app.filters', 'app.services', 'app.directives', 'ui.directives', 'ui.keypress', 'ui.bootstrap', 'segmentio', 'angularSmoothscroll'])
    .constant('appName', 'VideoNot.es')
    .constant('saveInterval', 15000)
    .constant('sampleVideo', 'http://www.youtube.com/watch?v=U6FvJ6jMGHU') // Please replace this with your Application ID.
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
    .run(['$rootScope', 'config', 'segmentio', function ($rootScope, config, segmentio) {
        $rootScope.$on('configLoaded', function (event, configData) {
            segmentio.load(configData.segmentio)
        });
        config.load();
    }])
    .run(['$rootScope', function ($rootScope) {
        // Many events binding
        $rootScope.$onMany = function (events, fn) {
            for (var i = 0; i < events.length; i++) {
                this.$on(events[i], fn);
            }
        };

        $rootScope.safeApply = function(fn) {
            var phase = this.$root.$$phase;
            if(phase == '$apply' || phase == '$digest') {
                if(fn && (typeof(fn) === 'function')) {
                    fn();
                }
            } else {
                this.$apply(fn);
            }
        };
    }]);