'use strict';

/* jasmine specs for controllers go here */

describe('Controllers', function () {
    var scope;

    var httpBackend;

    beforeEach(module('app'));
    beforeEach(inject(function($httpBackend) {
        httpBackend = $httpBackend;
        $httpBackend.expectGET('/config').respond(200, {'googleAnalyticsAccount': 'something'});
    }));

    beforeEach(inject(function($rootScope, analytics) {
        scope = $rootScope.$new();
        scope.tour = {
            next: function () {}
        };
        analytics.pushAnalytics = jasmine.createSpy('pushAnalytics');
        spyOn(scope, '$on');
    }));


    describe('VideoCtrl', function () {
        var videoCtrl;

        beforeEach(inject(function ($rootScope, $controller) {
            videoCtrl = $controller(VideoCtrl, {$scope: scope});
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

        it('should listen for shortcuts event', inject(function ($rootScope) {
            expect(scope.$on).toHaveBeenCalledWith('shortcut', jasmine.any(Function));
        }));

        it('should listen for loaded event', inject(function ($rootScope) {
            expect(scope.$on).toHaveBeenCalledWith('loaded', scope.loadVideo);
        }));

        it('should listen for videoLoaded event', inject(function ($rootScope) {
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

        it('should be able to play/pause video', inject(function (appName, $window) {
            expect(scope.doc).toBeDefined();
            expect(scope.youtubeVideo).toBe(false);
            expect(scope.videoStatus.playYoutube).toBe(false);
            expect(scope.videoStatus.playHtml5).toBe(false);

            $window._gaq.push = jasmine.createSpy('gaq');

            scope.doc.info = {
                video: 'http://www.youtube.com/watch?v=GKfHdOrR3lw'
            };

            scope.pauseVideo();

            expect(scope.videoStatus.playYoutube).toBe(false);
            expect(scope.videoStatus.playHtml5).toBe(true);

            scope.youtubeVideo = true;
            scope.pauseVideo();

            expect(scope.videoStatus.playYoutube).toBe(true);
            expect(scope.videoStatus.playHtml5).toBe(false);

            expect(scope.pushAnalytics).toHaveBeenCalledWith('Video', scope.videoStatus);
        }));

        it('has a loadVideo method which works for Youtube player', inject(function ($window, appName, youtubePlayerApi) {
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
            expect(scope.pushAnalytics).toHaveBeenCalledWith('Video', scope.doc.info.video);
        }));

        it('has a loadVideo method which works for HTML5 player', inject(function ($rootScope, $window, appName, youtubePlayerApi) {
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
            expect(scope.getCourseLectureCoursera).toHaveBeenCalled();
            expect(scope.endLoading).not.toHaveBeenCalled();
            expect(youtubePlayerApi.videoId).toEqual(null);
            expect(scope.pushAnalytics).toHaveBeenCalledWith('Video', scope.doc.info.video);

            expect(scope.loading).toBe(true);
        }));

        it('should have a loadSampleVideo method', inject(function (doc, sampleVideo) {
            scope.loadVideo = jasmine.createSpy();
            expect(scope.videoUrl).toBe(null);
            expect(doc.info).toBeUndefined();

            scope.loadSampleVideo();

            expect(scope.videoUrl).toEqual(sampleVideo);
            expect(scope.loadVideo).toHaveBeenCalled();
        }));
    });
});