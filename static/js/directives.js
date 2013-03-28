'use strict';

var module = angular.module('app.directives', []);

module.directive('aceEditor',
    function (editor) {
        return {
            restrict:'A',
            link:function (scope, element) {
                editor.rebind(element[0]);
            }
        };
    });

module.directive('html5VideoPlayer',
    function (video) {
        return {
            restrict:'A',
            link:function (scope, element) {
                video.bindVideoPlayer(element[0]);
            }
        };
    });

module.directive('star',
    function () {
        return {
            restrict:'E',
            replace:true,
            scope:{
                val:'=value',
                // Value bound to
                eventFn:'&click'
                // Optional expression evaluated on click
            },
            link:function (scope, element) {
                element.bind('click',
                    function () {
                        scope.$apply(function () {
                            scope.val = !scope.val;
                        });
                        scope.$eval(scope.eventFn, scope.val);
                    });
            },
            template:'<i class="star" ng-class="{\'icon-star\' : val, \'icon-star-empty\' : !val}" ng-click="toggle()"></i>'
        }
    });

module.directive('alert',
    function ($rootScope) {
        return {
            restrict:'E',
            replace:true,
            link:function (scope, element) {
                $rootScope.$on('error',
                    function (event, data) {
                        scope.message = data.message;
                        element.show();
                    });
                scope.close = function () {
                    element.hide();
                };
            },
            template:'<div class="hide alert alert-error">' +
                '  <span class="close" ng-click="close()">×</span>' +
                '  {{message}}' +
                '</div>'
        }
    });

module.directive('playPauseVideoHtml5', function(video) {
    return {
        link: function(scope, element, attrs) {
            scope.$watch(attrs.playPauseVideoHtml5, function(newValue, oldValue) {
                if(newValue != oldValue && video.player) {
                    newValue ? video.player.play() : video.player.pause();
                }
            });
        }
    }
});

module.directive('playPauseVideoYoutube', function(youtubePlayerApi) {
    return {
        link: function(scope, element, attrs) {
            scope.$watch(attrs.playPauseVideoYoutube, function(newValue, oldValue) {
                if(newValue != oldValue && youtubePlayerApi.player) {
                    newValue ? youtubePlayerApi.player.playVideo() : youtubePlayerApi.player.pauseVideo();
                }
            });
        }
    }
});

module.directive('bootstrapTooltip', function(youtubePlayerApi) {
    return {
        restrict:'A',
        link: function(scope, element, attrs) {
            $(element).tooltip();
        }
    }
});