'use strict';

/* jasmine specs for services go here */

describe('service', function() {
    beforeEach(function () {
        angular.module('appMock', [])
            .constant('saveInterval', function () { return 0; })
            .constant('appName', "VideoNotes test");
        angular.mock.module('app.services', 'youtube', 'analytics', 'appMock');
    });

    describe('video', function () {
        it("should be able to detect Coursera's lecture URL", inject(function (video) {
            var courseName = 'adhd-001', lectureId = 5;
            var url = 'https://class.coursera.org/{0}/lecture/{1}'.format(courseName, lectureId);
            var match = video.getCourseLectureCoursera(url);

            expect(match).not.toEqual(null);
            expect(match.length).toEqual(3);
            expect(match[0]).toEqual(url);
            expect(match[1]).toEqual(courseName);
            expect(parseInt(match[2])).toEqual(lectureId);
        }));

        it("should be able to detect Coursera's lecture download URL", inject(function (video) {
            var courseName = 'adhd-001', lectureId = 5;
            var url = 'https://class.coursera.org/{0}/lecture/download.mp4?lecture_id={1}'.format(courseName, lectureId);
            var match = video.getCourseLectureCoursera(url);

            expect(match).not.toEqual(null);
            expect(match.length).toEqual(3);
            expect(match[0]).toEqual(url);
            expect(match[1]).toEqual(courseName);
            expect(parseInt(match[2])).toEqual(lectureId);
        }));

        it("should be able to detect Youtube's video URL", inject(function (video) {
            var videoId = 'GKfHdOrR3lw';
            var url = 'http://www.youtube.com/watch?v={0}'.format(videoId);
            var videoIdResult = video.getYoutubeVideoId(url);

            expect(videoIdResult).toEqual('GKfHdOrR3lw');
        }));

        it("should have a load method calling Popcorn JS for MP4/Vimeo videos", inject(function(video) {
            var popcornMock = {
                destroy: jasmine.createSpy('destroy'),
                parseSRT:jasmine.createSpy('parseSRT')
            };
            spyOn(Popcorn, 'smart').andReturn(popcornMock);

            video.bindEvents = jasmine.createSpy('bindEvents');
            video.videoUrl = 'https://class.coursera.org/knowthyself-001/lecture/download.mp4?lecture_id=7';
            video.videoElement = {
                id:"testplayer"
            };

            video.load();

            expect(Popcorn.smart).toHaveBeenCalledWith("#{0}".format(video.videoElement.id), video.videoUrl);
            expect(video.bindEvents).toHaveBeenCalled();
            expect(video.subtitlesUrl).not.toEqual(null);
            expect(popcornMock.parseSRT).toHaveBeenCalledWith('/proxy?q={0}'.format(encodeURIComponent(video.subtitlesUrl)));

            video.videoUrl = 'https://class.videonotes.org/knowthyself-001/lecture/download.mp4?lecture_id=7';
            video.load();

            expect(popcornMock.destroy).toHaveBeenCalled();
            expect(video.subtitlesUrl).toEqual(null);
        }));

        it("should use Angular Youtube for Youtube videos", inject(function(video, youtubePlayerApi, $rootScope) {
            var videoId = "zDZFcDGpL4U";
            video.videoUrl = 'http://www.youtube.com/watch?v={0}'.format(videoId);
            video.bindEvents = jasmine.createSpy('bindEvents');
            video.videoElement = {
                id:"testplayer"
            };
            youtubePlayerApi.bindVideoPlayer = jasmine.createSpy('youtubePlayerApi.bindVideoPlayer');
            youtubePlayerApi.loadPlayer = jasmine.createSpy('youtubePlayerApi.loadPlayer').andCallFake(function () {youtubePlayerApi.player = {}});
            spyOn(Popcorn, 'smart');
            $rootScope.$broadcast = jasmine.createSpy();

            video.load();

            expect(Popcorn.smart).not.toHaveBeenCalledWith("#{0}".format(video.videoElement.id), video.videoUrl);
            expect(video.bindEvents).not.toHaveBeenCalled();
            expect(video.subtitlesUrl).toEqual(null);
            expect(youtubePlayerApi.bindVideoPlayer).toHaveBeenCalledWith(video.videoElement.id);
            expect(youtubePlayerApi.videoId).toEqual(videoId);
            expect(youtubePlayerApi.loadPlayer).toHaveBeenCalled();
            expect(video.player).toEqual(youtubePlayerApi.player);
            expect(video.player).toEqual(youtubePlayerApi.player);
            expect($rootScope.$broadcast).toHaveBeenCalledWith('videoLoaded');
        }));
    });

    describe('config', function () {
        it('should have a load method', inject(function (config){
            expect(config.load).toBeDefined();
        }));

        it('should call the config endpoint on load call', inject(function ($httpBackend, config, appName) {
            var response = {googleAnalyticsAccount:'test', appId: '1234'};
            $httpBackend.expectGET('/config').respond(200, response);

            config.load();

            $httpBackend.flush();
        }));
    });

    describe('autosaver', function () {
        it('should check document state each $saveInterval seconds', inject(function ($timeout, autosaver) {
            spyOn(autosaver, 'saveFn');
            $timeout.flush();
            expect(autosaver.saveFn).toHaveBeenCalled();
        }));

        it('should have a confirmOnLeave method which is returning a message', inject(function (doc, autosaver) {
            expect(typeof autosaver.confirmOnLeave).toBe('function');
            var msgExpected = "You have unsaved data.",
                msgReturned = autosaver.confirmOnLeave();
            expect(msgExpected).toEqual(msgReturned);
        }));

        it('should listen to beforeunload event', inject(function ($window, autosaver, doc) {
            spyOn($window, 'addEventListener');
            doc.dirty = true;
            autosaver.$apply();

            var msg = $window.addEventListener.mostRecentCall.args[1]({});

            expect(msg).toBeEqual("You have unsaved data.");
        }));
    });

    afterEach(inject(function($httpBackend) {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    }));
});
