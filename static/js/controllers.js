'use strict';

var controllersModule = angular.module('app.controllers', []);

controllersModule.controller('AppCtrl', ['$rootScope', '$scope', '$location', '$route', '$routeParams', '$timeout', '$log', 'appName', 'user', 'editor', 'segmentio', 'config',
    function ($rootScope, $scope, $location, $route, $routeParams, $timeout, $log, appName, user, editor, segmentio, config) {
    $scope.appName = appName;

    Modernizr.Detectizr.detect({detectOs: true, detectBrowser: true});

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

        initTour();

        $scope.isHome = $location.path() === '/';
    };

    $scope.auth = function () {
        segmentio.track('Sign in');
        if (!user.isAuthenticated()) {
            $location.path('/edit/');
        }
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
                segmentio.track('Tour started');
            },
            onShow: function (tour) {
                segmentio.track('Tour show step', {id:tour._current});
            },
            onEnd: function () {
                segmentio.track('Tour ended');
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
        segmentio.track('Document created');
    });
    $scope.$onMany(['firstSaved', 'loaded'], $scope.startTour);
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

controllersModule.controller('NavbarCtrl', ['$scope', function($scope) {
    $scope.menus = [];

    $scope.$on('setMenu', function (event, menus) {
        $scope.menus = menus;
    });
}]);

controllersModule.controller('HomeCtrl', ['$scope', '$rootScope', '$location', 'user', 'segmentio', function($scope, $rootScope, $location, user, segmentio) {
    $rootScope.$broadcast('setMenu', [{text:'Features', target:'features', offset: 50}]);
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
    $scope.isAuthenticated = user.isAuthenticated();

    $scope.$on('authentified', function () {
        $scope.user = user.getInfo();
        $scope.isAuthenticated = true;
    });
}]);

controllersModule.controller('MainCtrl', ['$scope', '$rootScope', 'user', function($scope, $rootScope, user) {
    if (!user.isAuthenticated()) {
        user.login();
    }

    $rootScope.$broadcast('setMenu', null);
}]);

controllersModule.controller('VideoCtrl', ['$scope', 'sampleVideo', 'doc', 'video', 'segmentio', function ($scope, sampleVideo, doc, video, segmentio) {
    $scope.doc = doc;
    $scope.videoUrl = null;
    $scope.edit = true;

    $scope.videoStatus = {
        error: false
    };

    $scope.submitVideo = function () {
        $scope.edit = false;
        $scope.videoStatus.error = false;
        if(!$scope.tour.ended()) {
            $scope.tour.hideStep(0);
            $scope.tour.showStep(1);
        }

        if(doc.info.video !== $scope.videoUrl) {
            doc.info.video = $scope.videoUrl;
            segmentio.track('Load video', {url: $scope.videoUrl});
            $scope.loadPlayer();
        }
    };

    $scope.startEdit = function () {
        segmentio.track('Change video');
        $scope.edit = true;
    };

    $scope.loadPlayer = function () {
        if (doc && doc.info && doc.info.video) {
            $scope.edit = false;
            $scope.videoUrl = doc.info.video;
            $scope.loading = true;

            $scope.videoStatus.error = false;
            $scope.videoStatus.speed = 1;

            if(video.videoUrl !== doc.info.video) {
                video.videoUrl = doc.info.video;
                video.load();
            }
        }
    };

    $scope.shortcuts = function (event, eventData) {
        switch (eventData.which) {
            case 32:
                if (eventData.ctrlKey) {
                    $scope.playPauseVideo();
                    eventData.preventDefault();
                }
                break;
        }
    };

    $scope.playPauseVideo = function () {
        if (doc.info && doc.info.video) {
            video.togglePlayPause();
            segmentio.track('Video {0}'.format(video.isPlaying() ? 'play' : 'pause'));
        }
    };

    $scope.endLoading = function () {
        $scope.loading = false;
    };

    $scope.loadSampleVideo = function () {
        segmentio.track('Video load sample');
        doc.info.video = sampleVideo;
        $scope.loadPlayer();
    };

    $scope.errorLoadVideo = function () {
        $scope.videoStatus.error = true;
        $scope.endLoading();
    };

    $scope.$on('shortcut', $scope.shortcuts);
    $scope.$on('loaded', $scope.loadPlayer);
    $scope.$on('video::loadeddata', $scope.endLoading);
    $scope.$on('video::error', $scope.errorLoadVideo);
}]);

controllersModule.controller('SpeedCtrl', ['$scope', 'video', 'segmentio', function ($scope, video, segmentio) {
    var speeds = new LinkedList();
    speeds.add(0.25);
    speeds.add(0.5);
    speeds.add(1);
    speeds.add(1.5);
    speeds.add(2);

    $scope.speeds = speeds.asArray();

    var init = function () {
        $scope.enabled = false;
        $scope.minSpeed = false;
        $scope.maxSpeed = false;
        $scope.currentSpeed = 1;
    };

    init();

    $scope.increasePlaybackRate = function () {
        var currentSpeed = speeds.findByValue($scope.currentSpeed);
        if(!$scope.maxSpeed && currentSpeed.hasNext()) {
            var nextSpeed = currentSpeed.getNext();
            $scope.currentSpeed = nextSpeed.getValue();

            $scope.minSpeed = false;
            $scope.maxSpeed = (nextSpeed.getValue() === speeds.getTail().getValue());
            segmentio.track('Video increase speed', {speed:$scope.currentSpeed});
        }
    };

    $scope.decreasePlaybackRate = function () {
        var currentSpeed = speeds.findByValue($scope.currentSpeed);
        if(!$scope.minSpeed && currentSpeed.hasPrevious()) {
            var prevSpeed = currentSpeed.getPrevious();
            $scope.currentSpeed = prevSpeed.getValue();

            $scope.minSpeed = (prevSpeed.getValue() === speeds.getHead().getValue());
            $scope.maxSpeed = false;
            segmentio.track('Video decrease speed', {speed:$scope.currentSpeed});
        }
    };

    $scope.$on('video::loadstart', init);

    $scope.$on('video::ratechange', function () {
        $scope.currentSpeed = video.playbackRate();
    });

    // Playback rate is buggy in Firefox
    if (Modernizr.Detectizr.device.browser !== "firefox") {
        var unregisterFunction;
        $scope.$on('video::loadeddata', function () {
            $scope.enabled = video.canRatePlayback();

            if($scope.enabled) {
                unregisterFunction = $scope.$watch('currentSpeed', function (newValue, oldValue) {
                    if(newValue !== oldValue) {
                        video.playbackRate(newValue);
                    }
                });
            }
            else if(unregisterFunction && typeof unregisterFunction == "function") {
                unregisterFunction();
            }
        });
    }

}]);


controllersModule.controller('EditorCtrl', ['$scope', 'editor', 'doc', 'autosaver', 'segmentio', function ($scope, editor, doc, autosaver, segmentio) {
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

controllersModule.controller('ShareCtrl', ['$scope','config','doc', 'segmentio', function($scope, config, doc, segmentio) {
    $scope.enabled = function () {
        return doc && doc.info && doc.info.id != null;
    };
    $scope.share = function () {
        var client = new gapi.drive.share.ShareClient(config.appId);
        client.setItemIds([doc.info.id]);
        client.showSettingsDialog();
        segmentio.track('Document share');
    }
}]);

controllersModule.controller('MenuCtrl', ['$scope', '$rootScope', '$window', 'config', 'editor', 'doc', 'segmentio', function ($scope, $rootScope, $window, config, editor, doc, segmentio) {
    var onFilePicked = function (data) {
        $scope.safeApply(function () {
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
        segmentio.track('Document open');
    };
    $scope.create = function () {
        editor.create();
        segmentio.track('Document create new');
    };
    $scope.save = function () {
        editor.save(true);
        segmentio.track('Document save');
    };

    $scope.$watch('sync.enabled', function () {
        if (doc && doc.info) {
            doc.info.syncNotesVideo.enabled = $scope.sync.enabled;
            segmentio.track('Editor sync {0}'.format($scope.sync.enabled ? "enable" : "disable"));
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

controllersModule.controller('RenameCtrl', ['$scope', '$timeout', 'doc', 'segmentio', function ($scope, $timeout, doc, segmentio) {
    $('#rename-dialog').on('show',
        function () {
            $scope.safeApply(function () {
                $scope.newFileName = doc.info.title;
                if(!$scope.tour.ended()) {
                    $scope.tour.hideStep(2);
                    $scope.tour.showStep(3);
                }
                segmentio.track('Document rename');
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