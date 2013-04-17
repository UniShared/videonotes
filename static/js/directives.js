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

module.directive('html5VideoPlayer',
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
    ['$rootScope', 'analytics', function ($rootScope, analytics) {
        return {
            restrict: 'E',
            replace: true,
            link: function (scope, element) {
                $rootScope.$on('error',
                    function (event, data) {
                        scope.$apply(function () {
                            analytics.pushAnalytics('Error', data.message);
                            scope.message = data.message;
                            $(element).show();
                        });
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