'use strict';

var controllersModule = angular.module('app.controllers', []);

controllersModule.controller('AppCtrl', ['$rootScope', '$scope', '$location', '$route', '$routeParams', '$timeout', '$log', 'appName', 'user', 'editor', 'analytics', 'config',
    function ($rootScope, $scope, $location, $route, $routeParams, $timeout, $log, appName, user, editor, analytics, config) {
    $scope.appName = appName;

    Modernizr.Detectizr.detect({detectOs: true});

    var isMac = Modernizr.Detectizr.device.os == "mac" && Modernizr.Detectizr.device.osVersion == "os x";
    $scope.device = {
        isMac: isMac,
        modifierSymbols: {
            meta: isMac ? '⌘' : '',
            ctrl: isMac ? '⌃' : 'Ctrl',
            alt:  isMac ? '⌥' : 'Alt'
        }
    };

    var redirectToDocument = function (event, fileId) {
        $location.path('/edit/' + fileId);
    };

    $scope.init = function () {
        if ($routeParams.id) {
            editor.load($routeParams.id);
            //$scope.startTour();
        }
        else if ($routeParams.templateId) {
            editor.copy($routeParams.templateId);
        }
        else {
            // New doc, but defer to next event cycle to ensure init
            $timeout(function () {
                    var parentId = $location.search()['parent'];
                    editor.create(parentId);
                    editor.save();
                },
                1);
        }

        config.load();
        initTour();
    };

    var initTour = function () {
        $scope.tour = new Tour({
            name: "tour",
            keyboard: true,
            labels: {
                end: 'End tour',
                next: 'Got it!',
                prev: '&laquo; Prev'
            },
            useLocalStorage: false,
            debug: false,
            onStart: function () {
                analytics.pushAnalytics('Tour', 'started');
            },
            onShow: function (tour) {
                analytics.pushAnalytics('Tour', 'show step {0}'.format(tour._current));
            },
            onEnd: function () {
                analytics.pushAnalytics('Tour', 'ended');
            }
        });

        $scope.tour.addStep({
            element: "#videoUrl",
            content: "Welcome!<br> First, copy/paste your video URL from Coursera, Youtube, etc.",
            placement: "bottom"
        });

        $scope.tour.addStep({
            element: "#editor",
            content: "This is the note editor." +
                "<br>All your notes will be automatically synchronized with the video. " +
                "<br>Just click on a line to jump to the right time!",
            placement: "left"
        });

        $scope.tour.addStep({
            element: ".doc-title a",
            content: "Now, you should name your notes",
            placement: "bottom"
        });

        $scope.tour.addStep({
            element: ".menu-open",
            content: "Later, you can open previous notes. <br> You can also manage them directly from your <a href='https://drive.google.com/' target='_blank'>Google Drive</a>",
            placement: "bottom"
        });

        $scope.tour.addStep({
            element: ".menu-help",
            content: "This menu will show you this tour again.",
            placement: "bottom"
        });

        $scope.tour.addStep({
            element: "#sync-switch",
            content: "You can switch on/off sync at any time." +
                     "<br>Shortcut is {0}".format(($scope.device.isMac ? "{0}{1}S" : "{0}+{1}+S").format($scope.device.modifierSymbols.ctrl, $scope.device.modifierSymbols.alt)),
            placement: "bottom"
        });

        $scope.tour.addStep({
            element: ".editor-state",
            content: "Everything will be automatically saved in your <a href='https://drive.google.com/?tab=mo&authuser=0#recent' target='_blank'>Google Drive</a>",
            placement: "bottom"
        });

        $scope.tour.addStep({
            element: "#btn-share",
            content: "You can already share your notes with anyone or make it private, as in <a href='https://drive.google.com/' target='_blank'>Google Drive</a>",
            placement: "left"
        });

        $scope.tour.addStep({
            element: "#uvTab",
            content: "Feel free to send us feedback.<br> Happy note-taking!",
            placement: "top"
        });
    };

    $scope.restartTour = function () {
        $scope.tour.end();
        $scope.tour.restart();
    };

    $scope.startTour = function () {
        $timeout(function () {
            $log.info('Start tour');
            $scope.tour && $scope.tour.start();
        }, 1);
    };

    $scope.shortcuts = function ($event) {
        $log.log($event);
        $scope.$broadcast('shortcut', $event);
    };

    $scope.$on('$routeChangeSuccess', $scope.init);
    $scope.$onMany(['firstSaved', 'copied', 'opened'], redirectToDocument);
    $scope.$on('firstSaved', function () {
        analytics.pushAnalytics('Document', 'created');
    });
    $scope.$onMany(['firstSaved', 'loaded'], $scope.startTour);
    $scope.$on('configLoaded', $scope.setConfig)
}]);

controllersModule.controller('OverlayCtrl', ['$scope', '$log', 'editor', function ($scope, $log, editor) {
    $scope.loading = editor.loading;

    $scope.$onMany(['firstSaving', 'loading'], function ($event) {
        $log.log('Enable loading from event ' + $event.name);
        $scope.loading = true;
    });

    $scope.$onMany(['firstSaved', 'loaded', 'error'], function ($event) {
        $log.info('Disable loading from event ' + $event.name);
        $scope.loading = false;
    });
}]);

controllersModule.controller('HomeCtrl', ['$scope', '$rootScope', '$location', 'user', function($scope, $rootScope, $location, user) {
    $scope.auth = function () {
        if (!user.isAuthenticated()) {
            $rootScope.$broadcast('loading');
            user.login().then(function () {
                $rootScope.$broadcast('loaded');
                $location.path('/edit/');
            });
        }
    };
}]);

/*function CoursesListCtrl($scope, $location, user, course) {
 course.list().then(function (courses) {
 $scope.courses = courses.data;
 });

 $scope.$on('authentified', function () {
 $location.path('/edit/template/' + course.getTemplateId());
 });

 $scope.startNotes = function (templateId) {
 course.setTemplateId(templateId);

 if(!user.isAuthenticated()) {
 user.login();
 }
 else {
 $location.path('/edit/template/' + templateId);
 }
 };

 if(course.getTemplateId()) {
 $scope.startNotes(course.getTemplateId());
 }
 }*/

controllersModule.controller('UserCtrl', ['$scope', '$rootScope', 'user', function ($scope, $rootScope, user) {
    $scope.$on('authentified', function () {
        $scope.user = user.getInfo();
    });
}]);

controllersModule.controller('MainCtrl', ['$scope', 'user', function($scope, user) {
    if (!user.isAuthenticated()) {
        user.login();
    }
}]);

controllersModule.controller('VideoCtrl', ['$scope', 'sampleVideo', 'doc', 'youtubePlayerApi', 'video', 'analytics', function ($scope, sampleVideo, doc, youtubePlayerApi, video, analytics) {
    $scope.canReadH264 = Modernizr.video.h264;
    $scope.youtubeVideo = false;
    $scope.doc = doc;
    $scope.videoUrl = null;

    $scope.videoStatus = {
        playYoutube: false,
        playHtml5: false,
        error: false
    };

    $scope.getYoutubeVideoId = function (url) {
        var regex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/,
            match = url.match(regex);

        if (match && match[2].length == 11) {
            return match[2];
        } else {
            return null;
        }
    };

    $scope.getCourseLectureCoursera = function (url) {
        var regex = /^https:\/\/class.coursera.org\/([a-z0-9-]+)\/lecture\/(\d+)$/;

        return url.match(regex);
    };

    $scope.submitVideo = function () {
        $scope.videoStatus.error = false;
        if(!$scope.tour.ended()) {
            $scope.tour.hideStep(0);
            $scope.tour.showStep(1);
        }

        var matchVideoCoursera = $scope.getCourseLectureCoursera($scope.videoUrl);
        if (matchVideoCoursera && matchVideoCoursera.length == 3) {
            $scope.videoUrl = 'https://class.coursera.org/' + matchVideoCoursera[1] + '/lecture/download.mp4?lecture_id=' + matchVideoCoursera[2]
        }

        doc.info.video = $scope.videoUrl;

        $scope.loadPlayer();
    };

    $scope.loadVideo = function () {
        if(!(doc.info && doc.info.video))
            return

        $scope.videoUrl = doc.info.video;

        $scope.loadPlayer();
    };

    $scope.loadPlayer = function () {
        if (doc && doc.info) {
            if (doc.info.video) {
                $scope.loading = true;
                $scope.videoStatus.playHtml5 = false;
                $scope.videoStatus.playYoutube = false;

                var videoId = $scope.getYoutubeVideoId($scope.videoUrl);
                if (videoId != null) {
                    $scope.youtubeVideo = true;
                    youtubePlayerApi.videoId = videoId;
                    youtubePlayerApi.loadPlayer();
                    $scope.endLoading();
                }
                else {
                    $scope.youtubeVideo = false;
                    video.videoUrl = doc.info.video;
                    video.load();
                }

                analytics.pushAnalytics('Video', $scope.videoUrl);
            }
        }
    };

    $scope.shortcuts = function (event, eventData) {
        switch (eventData.which) {
            case 32:
                if (eventData.ctrlKey) {
                    eventData.preventDefault();
                    $scope.pauseVideo();
                }
                break;
        }
    };

    $scope.pauseVideo = function () {
        if (doc.info && doc.info.video) {
            $scope.videoStatus.playYoutube = $scope.youtubeVideo && !$scope.videoStatus.playYoutube;
            $scope.videoStatus.playHtml5 = !$scope.youtubeVideo && !$scope.videoStatus.playHtml5;

            $scope.videoStatus.playYoutube ? youtubePlayerApi.player && youtubePlayerApi.player.playVideo() : youtubePlayerApi.player && youtubePlayerApi.player.pauseVideo();
            $scope.videoStatus.playHtml5 ? video.player && video.player.play() : video.player && video.player.pause();

            analytics.pushAnalytics('Video', $scope.videoStatus);
        }
    };

    $scope.endLoading = function () {
        $scope.loading = false;
        $scope.$apply();
    };

    $scope.loadSampleVideo = function () {
        analytics.pushAnalytics('Video', 'load sample');
        doc.info.video = sampleVideo;
        $scope.loadVideo();
    };

    $scope.errorLoadVideo = function () {
        $scope.videoStatus.error = true;
        $scope.endLoading();
    };

    $scope.$on('shortcut', $scope.shortcuts);
    $scope.$onMany(['loaded','$routeChangeSuccess'], $scope.loadVideo);
    $scope.$on('videoLoaded', $scope.endLoading);
    $scope.$on('videoError', $scope.errorLoadVideo);
}]);

controllersModule.controller('EditorCtrl', ['$scope', 'editor', 'doc', 'autosaver', 'analytics', function ($scope, editor, doc, autosaver, analytics) {
    $scope.editor = editor;
    $scope.doc = doc;

    $scope.init = function () {
            $scope.sync = {};
        if (doc.info && doc.info.syncNotesVideo) {
            if (doc.info.syncNotesVideo.enabled === undefined) {
                doc.info.syncNotesVideo.enabled = true;
            }

            $scope.sync.enabled = doc.info.syncNotesVideo.enabled
        }
        else {
            $scope.sync.enabled = true;
        }
    };

    $scope.$on('loaded', $scope.init);

    $scope.init();
}]);

controllersModule.controller('ShareCtrl', ['$scope','config','doc', 'analytics', function($scope, config, doc, analytics) {
    $scope.enabled = function () {
        return doc && doc.info && doc.info.id != null;
    };
    $scope.share = function () {
        var client = new gapi.drive.share.ShareClient(config.appId);
        client.setItemIds([doc.info.id]);
        client.showSettingsDialog();
        analytics.pushAnalytics('Document', 'Share');
    }
}]);

controllersModule.controller('MenuCtrl', ['$scope', '$rootScope', '$window', 'config', 'editor', 'doc', 'analytics', function ($scope, $rootScope, $window, config, editor, doc, analytics) {
    var onFilePicked = function (data) {
        $scope.$apply(function () {
            if (data.action == 'picked') {
                var id = data.docs[0].id;
                $rootScope.$broadcast('opened', id);
            }
        });
    };
    $scope.open = function () {
        var view = new google.picker.View(google.picker.ViewId.DOCS);
        view.setMimeTypes('application/vnd.unishared.document');
        var picker = new google.picker.PickerBuilder()
            .setAppId(config.appId)
            .addView(view)
            .setCallback(angular.bind(this, onFilePicked))
            .build();
        picker.setVisible(true);
        analytics.pushAnalytics('Document', 'Open');
    };
    $scope.create = function () {
        editor.create();
        analytics.pushAnalytics('Document', 'Create new');
    };
    $scope.save = function () {
        editor.save(true);
        analytics.pushAnalytics('Document', 'Save');
    };

    $scope.$watch('sync.enabled', function () {
        if (doc && doc.info) {
            doc.info.syncNotesVideo.enabled = $scope.sync.enabled;
            analytics.pushAnalytics('Editor', 'sync', $scope.sync.enabled ? "enable" : "disable");
        }
    }, true);

    $scope.saveShortcut = ($scope.device.isMac ? "{0}S" : "{0}+S").format($scope.device.isMac ? $scope.device.modifierSymbols.meta : $scope.device.modifierSymbols.ctrl);
    $scope.openShortcut = ($scope.device.isMac ? "{0}O" : "{0}+O").format($scope.device.isMac ? $scope.device.modifierSymbols.meta : $scope.device.modifierSymbols.ctrl);
    $scope.switchShortcut = ($scope.device.isMac ? "{0}{1}S" : "{0}+{1}+S").format($scope.device.modifierSymbols.ctrl, $scope.device.modifierSymbols.alt);

    $scope.shortcuts = function (event, eventData) {
        switch (eventData.which) {
            case 83: // "S"
                if(eventData.ctrlKey && eventData.altKey){
                    $scope.sync.enabled = !$scope.sync.enabled;
                    eventData.preventDefault();
                }
                else if (($scope.device.isMac && eventData.metaKey) || (!$scope.device.isMac && eventData.ctrlKey)) {
                    $scope.save();
                    eventData.preventDefault();
                }
                break;
            case 79: // "O"
                if (($scope.device.isMac && eventData.metaKey) || (!$scope.device.isMac && eventData.ctrlKey)) {
                    $scope.open();
                    eventData.preventDefault();
                }
                break;
        }
    };

    $scope.$on('shortcut', $scope.shortcuts);
}]);

controllersModule.controller('RenameCtrl', ['$scope', '$timeout', 'doc', 'analytics', function ($scope, $timeout, doc, analytics) {
    $('#rename-dialog').on('show',
        function () {
            $scope.$apply(function () {
                $scope.newFileName = doc.info.title;
                if(!$scope.tour.ended()) {
                    $scope.tour.hideStep(2);
                    $scope.tour.showStep(3);
                }
                analytics.pushAnalytics('Document', 'Rename');
            });
        });
    $scope.save = function () {
        doc.info.title = $scope.newFileName;
        $('#rename-dialog').modal('hide');
    };
}]);

controllersModule.controller('AboutCtrl', ['$scope', 'backend', function ($scope, backend) {
    $('#about-dialog').on('show',
        function () {
            backend.about().then(function (result) {
                $scope.info = result.data;
            });
        });
}]);