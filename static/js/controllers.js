'use strict';

function OverlayCtrl($scope, $log, editor, doc) {
    $scope.loading = (!doc.info) || editor.loading;

    $scope.$onMany(['loading', 'firstSaving'], function ($event) {
        $log.log('Enable loading from event ' + $event.name);
        $scope.loading = true;
    });

    $scope.$onMany(['loaded', 'firstSaved', 'error'], function ($event) {
        $log.info('Disable loading from event ' + $event.name);
        $scope.loading = false;
    });
}

function MainCtrl($scope, $location, $routeParams, $timeout, $log, editor, doc) {
    $scope.redirectToDocument = function (event, fileInfo) {
        $location.path('/edit/' + fileInfo.id);
    };

    $scope.init = function () {
        if ($routeParams.id) {
            editor.load($routeParams.id);
        }
        else if ($routeParams.templateId) {
            editor.copy($routeParams.templateId);
        }
        else {
            // New doc, but defer to next event cycle to ensure init
            $timeout(function () {
                    var parentId = $location.search()['parent'];
                    editor.create(parentId);
                    editor.save(true);
                },
                1);
        }
    };

    $scope.shortcuts = function ($event) {
        $log.log($event);
        $scope.$broadcast('shortcut', $event);
        $event.preventDefault();
    };

    $scope.$onMany(['firstSaved', 'copied'], $scope.redirectToDocument);

    $scope.$on('authentified', function () {
        $scope.init();
    });

    $scope.init();
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
    }

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

function VideoCtrl($scope, $window, appName, doc, youtubePlayerApi) {
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

    $scope.loadVideo = function () {
        $scope.loading = true;

        if(doc && doc.info) {
            $scope.videoUrl = (this && this.videoUrl) || doc.info.video;

            if($scope.videoUrl) {
                var videoId = $scope.getYoutubeVideoId($scope.videoUrl);

                if(videoId != null) {
                    $scope.youtubeVideo = true;
                    doc.info.video = $scope.videoUrl;
                    youtubePlayerApi.videoId = videoId;
                    youtubePlayerApi.loadPlayer();
                    $scope.loading = false;
                }
                else {
                    $scope.youtubeVideo = false;
                    $scope.$on('videoLoaded', function () { $scope.loading = false });
                    doc.info.video = $scope.videoUrl;
                }

                $window._gaq.push(['_trackEvent', appName, 'Video', $scope.videoUrl]);
            }
        }


    };

    $scope.pauseVideo = function() {
        if(doc.info && doc.info.video) {
            $scope.videoStatus.playYoutube = $scope.youtubeVideo && !$scope.videoStatus.playYoutube;
            $scope.videoStatus.playHtml5 = !$scope.youtubeVideo && !$scope.videoStatus.playHtml5;
            $window._gaq.push(['_trackEvent', appName, 'Video', $scope.videoStatus]);
        }
    };

    $scope.$on('shortcut', $scope.pauseVideo);
    $scope.$on('loaded', $scope.loadVideo);
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
        $window._gaq.push(['_trackEvent', appName, 'Open document']);
    };
    $scope.create = function () {
        editor.create();
        $window._gaq.push(['_trackEvent', appName, 'Create new document']);
    };
    $scope.save = function () {
        editor.save(true);
        $window._gaq.push(['_trackEvent', appName, 'Save document']);
    }
}

function RenameCtrl($scope, $window, appName, doc) {
    $('#rename-dialog').on('show',
        function () {
            $scope.$apply(function () {
                $scope.newFileName = doc.info.title;
                $window._gaq.push(['_trackEvent', appName, 'Rename document']);
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