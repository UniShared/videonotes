'use strict';

/* jasmine specs for controllers go here */

describe('Controllers', function () {
    var scope;

    beforeEach(angular.mock.module('app', 'analytics'));

    beforeEach(angular.mock.inject(function($rootScope, analytics) {
        scope = $rootScope.$new();
        scope.tour = {
            next: function () {}
        };
        analytics.pushAnalytics = jasmine.createSpy('pushAnalytics');
        spyOn(scope, '$on');
    }));


    describe('VideoCtrl', function () {
        var videoCtrl;

        beforeEach(angular.mock.inject(function ($rootScope, $controller, doc, video, youtubePlayerApi) {
            doc.info = {};

            video.player = {
                play: jasmine.createSpy(),
                pause: jasmine.createSpy()
            };
            video.load = jasmine.createSpy();

            youtubePlayerApi.player = {
                playVideo: jasmine.createSpy(),
                pauseVideo: jasmine.createSpy()
            };

            videoCtrl = $controller('VideoCtrl', {$scope: scope});
        }));

        it('should have a VideoCtrl controller', function () {
            expect(videoCtrl).not.toEqual(null);
            expect(scope).not.toEqual(null);

            expect(scope.videoUrl).toEqual(null);
            expect(scope.videoStatus.playHtml5).toBe(false);
            expect(scope.videoStatus.playYoutube).toBe(false);
            expect(scope.doc).toBeDefined();
            expect(scope.canReadH264).toBeDefined();
            expect(scope.youtubeVideo).toBe(false);
        });

        it('should listen for shortcuts event', angular.mock.inject(function () {
            expect(scope.$on).toHaveBeenCalledWith('shortcut', jasmine.any(Function));
        }));

        it('should listen for loaded event', angular.mock.inject(function () {
            expect(scope.$on).toHaveBeenCalledWith('loaded', scope.loadVideo);
        }));

        it('should listen for videoLoaded event', angular.mock.inject(function () {
            expect(scope.$on).toHaveBeenCalledWith('videoLoaded', scope.endLoading);
        }));

        it("should be able to detect Youtube's video URL", function () {
            var videoId = 'GKfHdOrR3lw';
            var url = 'http://www.youtube.com/watch?v={0}'.format(videoId);
            var videoIdResult = scope.getYoutubeVideoId(url);

            expect(videoIdResult).not.toEqual(null);
            expect(videoIdResult).toEqual('GKfHdOrR3lw');
        });

        it("should be able to detect Coursera's lecture URL", function () {
            var courseName = 'adhd-001', lectureId = 5;
            var url = 'https://class.coursera.org/{0}/lecture/{1}'.format(courseName, lectureId);
            var match = scope.getCourseLectureCoursera(url);

            expect(match.length).toEqual(3);
            expect(match[0]).toEqual(url);
            expect(match[1]).toEqual(courseName);
            expect(parseInt(match[2])).toEqual(lectureId);
        });

        it('should be able to play/pause video', angular.mock.inject(function (appName, $window, analytics, video, youtubePlayerApi) {
            expect(scope.pauseVideo).toBeDefined();
            expect(scope.doc).toBeDefined();
            expect(scope.youtubeVideo).toBe(false);
            expect(scope.videoStatus.playYoutube).toBe(false);
            expect(scope.videoStatus.playHtml5).toBe(false);

            $window._gaq.push = jasmine.createSpy('gaq');

            scope.doc.info = {
                video: 'http://video.unishared.com/test.mp4'
            };

            scope.pauseVideo();

            expect(scope.videoStatus.playYoutube).toBe(false);
            expect(scope.videoStatus.playHtml5).toBe(true);
            expect(video.player.play).toHaveBeenCalled();

            scope.doc.info = {
                video: 'http://www.youtube.com/watch?v=GKfHdOrR3lw'
            };

            scope.youtubeVideo = true;
            scope.pauseVideo();

            expect(scope.videoStatus.playYoutube).toBe(true);
            expect(scope.videoStatus.playHtml5).toBe(false);
            expect(youtubePlayerApi.player.playVideo).toHaveBeenCalled();

            expect(analytics.pushAnalytics).toHaveBeenCalledWith('Video', scope.videoStatus);
        }));

        it('has a loadVideo method which works for Youtube player', angular.mock.inject(function ($window, appName, youtubePlayerApi, analytics) {
            expect(scope.loading).toBeUndefined();

            spyOn(scope, 'getYoutubeVideoId').andCallThrough();
            spyOn(scope, 'getCourseLectureCoursera').andCallThrough();
            spyOn(scope, 'endLoading').andCallThrough();

            spyOn(youtubePlayerApi, 'loadPlayer').andCallThrough();

            scope.doc.info = {
                video: 'http://www.youtube.com/watch?v=GKfHdOrR3lw'
            };

            scope.loadVideo();

            expect(scope.youtubeVideo).toBe(true);
            expect(scope.loading).toBe(false);
            expect(scope.getYoutubeVideoId).toHaveBeenCalled();
            expect(scope.getCourseLectureCoursera).not.toHaveBeenCalled();
            expect(scope.endLoading).toHaveBeenCalled();
            expect(youtubePlayerApi.videoId).toEqual('GKfHdOrR3lw');
            expect(youtubePlayerApi.loadPlayer).toHaveBeenCalled();
            expect(analytics.pushAnalytics).toHaveBeenCalledWith('Video', scope.doc.info.video);
        }));

        it('has a loadVideo method which works for HTML5 player', angular.mock.inject(function ($rootScope, $window, appName, youtubePlayerApi, analytics) {
            expect(scope.loading).toBeUndefined();

            spyOn(scope, 'getYoutubeVideoId').andCallThrough();
            spyOn(scope, 'getCourseLectureCoursera').andCallThrough();
            spyOn(scope, 'endLoading').andCallThrough();

            scope.doc.info = {
                video: 'https://class.coursera.org/knowthyself-001/lecture/download.mp4?lecture_id=7'
            };
            scope.loadVideo();

            expect(scope.youtubeVideo).toBe(false);
            expect(scope.getYoutubeVideoId).toHaveBeenCalled();
            expect(scope.endLoading).not.toHaveBeenCalled();
            expect(youtubePlayerApi.videoId).toEqual(null);
            expect(analytics.pushAnalytics).toHaveBeenCalledWith('Video', scope.doc.info.video);

            expect(scope.loading).toBe(true);
        }));

        it('should have a loadSampleVideo method', angular.mock.inject(function (doc, sampleVideo) {
            scope.loadVideo = jasmine.createSpy();
            expect(scope.videoUrl).toBe(null);
            expect(doc.info.video).toBeUndefined();

            scope.loadSampleVideo();

            expect(scope.loadVideo).toHaveBeenCalled();
        }));
    });

    describe('ShareCtrl', function () {
        var shareCtrl;

        beforeEach(angular.mock.inject(function ($rootScope, $controller, doc) {
            shareCtrl = $controller('ShareCtrl', {$scope: scope});

            doc.info = {
                id: '1234'
            };
        }));

        it('should have a ShareCtrl controller', function () {
            expect(shareCtrl).not.toEqual(null);
            expect(scope).not.toEqual(null);

            expect(scope.enabled).toBeDefined();
            expect(scope.share).toBeDefined();
        });


        it('should call analytics on share', inject(function (analytics) {
            scope.share();

            expect(analytics.pushAnalytics).toHaveBeenCalledWith('Document', 'Share');
        }));

        it('should call gapi on share', inject(function (config, doc) {
            config.appId = 'testAppId';

            var shareClientMock = {
                setItemIds: jasmine.createSpy('setItemIds'),
                showSettingsDialog: jasmine.createSpy('showSettingsDialog')
            };
            spyOn(gapi.drive.share, 'ShareClient').andReturn(shareClientMock);

            scope.share();

            expect(gapi.drive.share.ShareClient).toHaveBeenCalledWith(config.appId);
            expect(shareClientMock.setItemIds).toHaveBeenCalledWith([doc.info.id]);
            expect(shareClientMock.showSettingsDialog).toHaveBeenCalled();
        }));
    })
});
