'use strict';

function OverlayCtrl($scope, $log, editor, doc) {
    $scope.loading = editor.loading;

    $scope.$onMany(['loading'], function ($event) {
        $log.log('Enable loading from event ' + $event.name);
        $scope.loading = true;
    });

    $scope.$onMany(['loaded', 'error'], function ($event) {
        $log.info('Disable loading from event ' + $event.name);
        $scope.loading = false;
    });
}

function MainCtrl($scope, $location, $route, $routeParams, $timeout, $log, $window, appName, editor) {
    $scope.redirectToDocument = function (event, fileInfo) {
        $location.path('/edit/' + fileInfo.id);
    };

    $scope.init = function () {
        if($route.current.action === Actions.LOAD) {
            if ($routeParams.id) {
                editor.load($routeParams.id);
            }
            else if ($routeParams.templateId) {
                editor.copy($routeParams.templateId);
            }
        }
        else if($route.current.action === Actions.CREATE) {
            // New doc, but defer to next event cycle to ensure init
            $timeout(function () {
                    var parentId = $location.search()['parent'];
                    editor.create(parentId);
                    $scope.startTour();
                },
                1);
        }

        $scope.initTour();
    };

    $scope.initTour = function () {
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
                $scope.pushAnalytics('Tour', 'started');
            },
            onShow: function (tour) {
                $scope.pushAnalytics('Tour', 'show step {0}'.format(tour._current));
            },
            onEnd: function () {
                $scope.pushAnalytics('Tour', 'ended');
            }
        });

        $scope.tour.addStep({
            element: "#video-url-form",
            content: "Welcome!<br> First, copy/paste your video URL from Coursera, Youtube, etc.",
            placement: "bottom"
        });

        $scope.tour.addStep({
            element: "#editor",
            content: "This is the note editor.<br>All your notes will be automatically synchronized with the video",
            placement: "left"
        });

        $scope.tour.addStep({
            element: ".docTitle",
            content: "Now, you should name your notes",
            placement: "bottom"
        });

        $scope.tour.addStep({
            element: ".editor-state",
            content: "Everything will be automatically saved in your <a href='https://drive.google.com/?tab=mo&authuser=0#recent' target='_blank'>Google Drive</a>",
            placement: "bottom"
        });

        $scope.tour.addStep({
            element: ".menu-file",
            content: "Later, you can find all your notes or create new one from this menu. <br> You can also manage them directly from <a href='https://drive.google.com/' target='_blank'>Google Drive</a>",
            placement: "right"
        });

        $scope.tour.addStep({
            element: ".menu-help",
            content: "This menu will show you this tour again.",
            placement: "bottom"
        });

        $scope.tour.addStep({
            element: "#shortcuts",
            content: "You can play/pause the video by pressing ctrl-enter",
            placement: "right"
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
        $scope.tour.start();
    };

    $scope.shortcuts = function ($event) {
        $log.log($event);
        $scope.$broadcast('shortcut', $event);
    };

    $scope.pushAnalytics = function (category, event) {
        if(category) {
            if(event) {
                $log.info('Tracking event to Google Analytics', category, event);
                $window._gaq.push(['_trackEvent', appName, category, event]);
            }
            else {
                $window._gaq.push(['_trackEvent', appName, category]);
            }
        }
    };

    $scope.$on('authentified', $scope.init);
    $scope.$onMany(['firstSaved', 'copied'], $scope.redirectToDocument);
    $scope.$on('loaded', $scope.startTour);
}

function CoursesListCtrl($scope, $location, user, course) {
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
}

function UserCtrl($scope, user, backend) {
    if(!user.isAuthenticated()) {
        user.login();
    }

    $scope.$on('authentified', function () {
        $scope.user = user.getInfo();
    });
}

function VideoCtrl($scope, sampleVideo, doc, youtubePlayerApi) {
    $scope.canReadH264 = Modernizr.video.h264;
    $scope.youtubeVideo = false;
    $scope.doc = doc;
    $scope.videoUrl = null;

    $scope.videoStatus = {
        playYoutube: false,
        playHtml5: false
    };

    $scope.getYoutubeVideoId = function(url) {
        var regex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]{11,11}).*/,
            match = url.match(regex);

        if(match && match.length >= 2) {
            return match[2];
        }
        else {
            return null;
        }
    };

    $scope.getCourseLectureCoursera = function (url) {
        var regex = /^https:\/\/class.coursera.org\/([a-z0-9-]+)\/lecture\/(\d+)$/;

        return url.match(regex);
    };

    $scope.loadVideo = function () {
        if(doc && doc.info) {
            $scope.videoUrl = $scope.videoUrl || doc.info.video;

            if($scope.videoUrl) {
                $scope.loading = true;
                $scope.tour.next();

                var videoId = $scope.getYoutubeVideoId($scope.videoUrl);

                if(videoId != null) {
                    $scope.youtubeVideo = true;
                    doc.info.video = $scope.videoUrl;
                    youtubePlayerApi.videoId = videoId;
                    youtubePlayerApi.loadPlayer();
                    $scope.endLoading();
                }
                else {
                    $scope.youtubeVideo = false;

                    var matchVideoCoursera = $scope.getCourseLectureCoursera($scope.videoUrl);
                    if(matchVideoCoursera && matchVideoCoursera.length == 3) {
                        doc.info.video = 'https://class.coursera.org/' + matchVideoCoursera[1] + '/lecture/download.mp4?lecture_id=' + matchVideoCoursera[2]
                    }
                    else {
                        doc.info.video = $scope.videoUrl;
                    }

                }
                $scope.pushAnalytics('Video', $scope.videoUrl);
            }
        }
    };

    $scope.shortcuts = function (event, eventData) {
        switch (eventData.which) {
            case 0:
            case 32:
                if(eventData.ctrlKey) {
                    event.preventDefault();
                    $scope.pauseVideo();
                }
            break;
        }
    };

    $scope.pauseVideo = function() {
        if(doc.info && doc.info.video) {
            $scope.videoStatus.playYoutube = $scope.youtubeVideo && !$scope.videoStatus.playYoutube;
            $scope.videoStatus.playHtml5 = !$scope.youtubeVideo && !$scope.videoStatus.playHtml5;
            $scope.pushAnalytics('Video', $scope.videoStatus);
        }
    };

    $scope.endLoading = function () {
        $scope.loading = false;
    };

    $scope.loadSampleVideo = function () {
        $scope.videoUrl = sampleVideo;
        $scope.loadVideo();
    };

    $scope.$on('shortcut', $scope.shortcuts);
    $scope.$on('loaded', $scope.loadVideo);
    $scope.$on('videoLoaded', $scope.endLoading);
}

function EditorCtrl($scope, editor, doc, autosaver) {
    $scope.editor = editor;
    $scope.doc = doc;
}

function ShareCtrl($scope, appId, doc) {
    /*
     var client = gapi.drive.share.ShareClient(appId);
     $scope.enabled = function() {
     return doc.resource_id != null;
     };
     $scope.share = function() {
     client.setItemIds([doc.resource_id]);
     client.showSharingSettings();
     }
     */
}

function MenuCtrl($scope, $location, $window, appName, appId, editor) {
    var onFilePicked = function (data) {
        $scope.$apply(function () {
            if (data.action == 'picked') {
                var id = data.docs[0].id;
                $location.path('/edit/' + id);
            }
        });
    };
    $scope.open = function () {
        var view = new google.picker.View(google.picker.ViewId.DOCS);
        view.setMimeTypes('application/vnd.unishared.document');
        var picker = new google.picker.PickerBuilder()
            .setAppId(appId)
            .addView(view)
            .setCallback(angular.bind(this, onFilePicked))
            .build();
        picker.setVisible(true);
        $scope.pushAnalytics('Open document');
    };
    $scope.create = function () {
        editor.create();
        $scope.pushAnalytics('Create new document');
    };
    $scope.save = function () {
        editor.save(true);
        $scope.pushAnalytics('Save document');
    }
}

function RenameCtrl($scope, $window, appName, doc) {
    $('#rename-dialog').on('show',
        function () {
            $scope.$apply(function () {
                $scope.newFileName = doc.info.title;
                $scope.tour.next();
                $scope.pushAnalytics('Rename document');
            });
        });
    $scope.save = function () {
        doc.info.title = $scope.newFileName;
        $('#rename-dialog').modal('hide');
    };
}

function AboutCtrl($scope, backend) {
    $('#about-dialog').on('show',
        function () {
            backend.about().then(function (result) {
                $scope.info = result.data;
            });
        });
}