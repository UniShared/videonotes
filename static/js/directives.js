//Copyright (C) 2013 UniShared Inc.
//
//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var module = angular.module('app.directives', []);

module.directive('aceEditor',
    ['editor', function (editor) {
        return {
            restrict: 'A',
            scope: {
                sync: "="
            },
            link: function (scope, element) {
                editor.rebind(element[0]);

                scope.$watch('sync', function (newValue, oldValue) {
                    if (newValue !== oldValue) {
                        var gutter = $(element).find('.ace_gutter');
                        newValue ? gutter.removeClass('inactive') : gutter.addClass('inactive');
                    }
                }, true);
            }
        };
    }]);

module.directive('videoPlayer',
    ['video', function (video) {
        return {
            restrict: 'A',
            link: function (scope, element) {
                video.bindVideoPlayer(element[0]);
            }
        };
    }]);

module.directive('star',
    function () {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                val: '=',
                // Value bound to
                eventFn: '&click'
                // Optional expression evaluated on click
            },
            link: function (scope, element) {
                element.bind('click',
                    function () {
                        scope.$apply(function () {
                            scope.val = !scope.val;
                        });
                        scope.$eval(scope.eventFn, scope.val);
                    });
            },
            template: '<i class="star" ng-class="{\'icon-star\' : val, \'icon-star-empty\' : !val}" ng-click="toggle()"></i>'
        }
    });

module.directive('alert',
    ['$rootScope', 'segmentio', function ($rootScope, segmentio) {
        return {
            restrict: 'E',
            replace: true,
            link: function (scope, element) {
                $rootScope.$on('error',
                    function (event, data) {
                        segmentio.track('Error', {message:data.message});
                        scope.message = data.message;
                        $(element).show();
                    });
                scope.close = function () {
                    $(element).hide();
                };
            },
            template: '<div class="hide alert alert-error">' +
                '  <span class="close" ng-click="close()">&times;</span>' +
                '  {{message}}' +
                '</div>'
        }
    }]);

module.directive('bootstrapSwitch', ['$rootScope', function ($rootScope) {
    return {
        restrict: 'E',
        scope: {
            property: "="
        },
        link: function (scope, element) {
            $(element).bootstrapSwitch();

            scope.$watch('property', function () {
                if (scope.property !== undefined)
                    $(element).bootstrapSwitch('setState', scope.property);
            });

            $(element).on('switch-change', function (e, data) {
                scope.property = data.value;
                $rootScope.$$phase || $rootScope.$apply();
            });
        },
        replace: true,
        template: '<div class="switch switch-small">\n    <input type="checkbox" />\n</div>'

    }
}]);