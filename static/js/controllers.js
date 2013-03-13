'use strict';

function OverlayCtrl($scope, editor) {
    $scope.loading = editor.loading;
    $scope.$on('loading', function () {
        $scope.loading = true;
    });
    $scope.$on('loaded', function () {
        $scope.loading = false;
    });
}

function MainCtrl($scope, $location, $routeParams, $timeout, $window, $log, editor, doc, user) {
    $scope.redirectToDocument = function () {
        $location.path('/edit/' + doc.resource_id);
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
                },
                1);
        }
    };

    $scope.shortcuts = function ($event) {
        $log.log($event);
        $scope.$broadcast('shortcut', $event);
        $event.preventDefault();
    };

    $scope.$on('saved', $scope.redirectToDocument);
    $scope.$on('copied', $scope.redirectToDocument);
    $scope.$on('authentified', function () {
        $scope.init();
    });

    if(!user.isAuthenticated()) {
        user.login();
    }
    else {
        $scope.init();
    }
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
    $scope.$on('authentified', function () {
        $scope.user = user.getInfo();
    });

    $scope.$on('needAutorisation', function (event, args) {
        window.location.href = args;
    });
}

function VideoCtrl($scope, $window, doc, youtubePlayerApi) {
    $scope.canReadH264 = Modernizr.video.h264;
    $scope.youtubeVideo = false;
    $scope.doc = doc;
    $scope.videoUrl = null;

    $scope.videoStatus = {
        play: false
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
        if(doc && doc.info) {
            $scope.videoUrl = (this && this.videoUrl) || doc.info.video;

            if($scope.videoUrl) {
                var videoId = $scope.getYoutubeVideoId($scope.videoUrl);

                if(videoId != null) {
                    $scope.youtubeVideo = true;
                    doc.info.video = 'http://www.youtube.com/embed/'+videoId;
                    youtubePlayerApi.videoId = videoId;
                    youtubePlayerApi.loadPlayer();
                }
                else {
                    $scope.youtubeVideo = false;
                    doc.info.video = $scope.videoUrl;
                }

                $window._gaq.push(['_trackEvent', 'UniShared DrEdit', 'Video', $scope.videoUrl]);
            }
        }
    };

    $scope.pauseVideo = function() {
        if(doc.info && doc.info.video) {
            $scope.videoStatus.play = !$scope.videoStatus.play;
            $window._gaq.push(['_trackEvent', 'UniShared DrEdit', 'Video', $scope.videoStatus]);
        }
    };

    $scope.$on('shortcut', $scope.pauseVideo);
    $scope.$on('loaded', $scope.loadVideo);

    $scope.loadVideo();
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

function MenuCtrl($scope, $location, $window, appId, editor) {
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
        $window._gaq.push(['_trackEvent', 'UniShared DrEdit', 'Open document']);
    };
    $scope.create = function () {
        editor.create();
        $window._gaq.push(['_trackEvent', 'UniShared DrEdit', 'Create new document']);
    };
    $scope.save = function () {
        editor.save(true);
        $window._gaq.push(['_trackEvent', 'UniShared DrEdit', 'Save document']);
    }
}

function RenameCtrl($scope, doc) {
    $('#rename-dialog').on('show',
        function () {
            $scope.$apply(function () {
                $scope.newFileName = doc.info.title;
                $window._gaq.push(['_trackEvent', 'UniShared DrEdit', 'Rename document']);
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