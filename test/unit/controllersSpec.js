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
        spyOn(scope, '$on').andCallThrough();
    }));


    describe('VideoCtrl', function () {
        var videoCtrl;

        beforeEach(angular.mock.inject(function ($rootScope, $controller, doc, video) {
            doc.info = {};

            video.play = jasmine.createSpy();
            video.pause = jasmine.createSpy();
            video.load = jasmine.createSpy();

            videoCtrl = $controller('VideoCtrl', {$scope: scope});
        }));

        it('should be defined', function () {
            expect(videoCtrl).not.toEqual(null);
            expect(scope).not.toEqual(null);

            expect(scope.videoUrl).toEqual(null);
            expect(scope.videoStatus.play).toBe(false);
            expect(scope.doc).toBeDefined();
        });

        it('should listen for shortcuts event', angular.mock.inject(function () {
            expect(scope.$on).toHaveBeenCalledWith('shortcut', jasmine.any(Function));
        }));

        it('should listen for loaded event', angular.mock.inject(function () {
            expect(scope.$on).toHaveBeenCalledWith('loaded', scope.loadPlayer);
        }));

        it('should listen for videoLoaded event', angular.mock.inject(function () {
            expect(scope.$on).toHaveBeenCalledWith('videoLoaded', scope.endLoading);
        }));

        it('should be able to play/pause video', angular.mock.inject(function (analytics, video) {
            expect(scope.playPauseVideo).toBeDefined();
            expect(scope.doc).toBeDefined();
            expect(scope.videoStatus.play).toBe(false);

            scope.doc.info = {
                video: 'http://video.unishared.com/test.mp4'
            };

            scope.playPauseVideo();

            expect(scope.videoStatus.play).toBe(true);
            expect(video.play).toHaveBeenCalled();
            expect(video.pause).not.toHaveBeenCalled();
            expect(analytics.pushAnalytics).toHaveBeenCalledWith('Video', 'play pause', 'play')

            scope.doc.info = {
                video: 'http://www.youtube.com/watch?v=GKfHdOrR3lw'
            };

            // Reinit the spies
            video.play = jasmine.createSpy('video.player.play');
            video.pause = jasmine.createSpy('video.player.pause');

            scope.playPauseVideo();

            expect(scope.videoStatus.play).toBe(false);
            expect(video.play).not.toHaveBeenCalled();
            expect(video.pause).toHaveBeenCalled();
            expect(analytics.pushAnalytics).toHaveBeenCalledWith('Video', 'play pause', 'pause')
        }));

        it('has a loadPlayer method which works for Youtube video', angular.mock.inject(function (video) {
            expect(scope.loading).toBeUndefined();

            spyOn(scope, 'endLoading').andCallThrough();

            scope.doc.info = {
                video: 'http://www.youtube.com/watch?v=GKfHdOrR3lw'
            };

            scope.loadPlayer();

            expect(video.videoUrl).toEqual(scope.doc.info.video);
            expect(scope.videoStatus.play).toBe(false);
            expect(scope.loading).toBe(true);
            expect(video.load).toHaveBeenCalled();
        }));

        it('has a loadPlayer method which works for MP4 video', angular.mock.inject(function (video) {
            expect(scope.loading).toBeUndefined();

            video.load = jasmine.createSpy('load');
            spyOn(scope, 'endLoading').andCallThrough();

            scope.doc.info = {
                video: 'https://class.coursera.org/knowthyself-001/lecture/download.mp4?lecture_id=7'
            };

            scope.loadPlayer();

            expect(video.videoUrl).toEqual(scope.doc.info.video);
            expect(scope.videoStatus.play).toBe(false);
            expect(scope.loading).toBe(true);
            expect(video.load).toHaveBeenCalled();
        }));

        it('should have a loadSampleVideo method', angular.mock.inject(function (doc) {
            scope.loadPlayer = jasmine.createSpy();
            expect(scope.videoUrl).toBe(null);
            expect(doc.info.video).toBeUndefined();

            scope.loadSampleVideo();

            expect(scope.loadPlayer).toHaveBeenCalled();
        }));

        it('should have a endLoading method', angular.mock.inject(function (doc, sampleVideo, video) {
            scope.endLoading();
            expect(scope.loading).toBeFalsy();
        }));

        describe('shortcuts method', function () {
            it('should react to ctrl space shortcut', function () {
                var keyEvent = {
                    which: 32,
                    ctrlKey: true,
                    preventDefault: jasmine.createSpy()
                };
                scope.playPauseVideo = jasmine.createSpy();

                scope.shortcuts(null, keyEvent);
                expect(keyEvent.preventDefault).toHaveBeenCalled();
                expect(scope.playPauseVideo).toHaveBeenCalled();
            });

            it('should not react to other combinations', function () {
                var keyEvent = {
                    which: 90,
                    ctrlKey: true,
                    preventDefault: jasmine.createSpy()
                };
                scope.playPauseVideo = jasmine.createSpy();

                scope.shortcuts(null, keyEvent);
                expect(keyEvent.preventDefault).not.toHaveBeenCalled();
                expect(scope.playPauseVideo).not.toHaveBeenCalled();
            });

        });

        it('should have a errorLoadVideo method', function () {
            scope.endLoading = jasmine.createSpy('endLoading');
            scope.errorLoadVideo();
            expect(scope.videoStatus.error).toBeTruthy();
            expect(scope.endLoading).toHaveBeenCalled();
        });

        describe('submitVideo method', function () {
            it('should store the video URL typed', inject(function (analytics, doc) {
                scope.loadPlayer = jasmine.createSpy();
                scope.tour = {
                    ended: jasmine.createSpy('tour.ended').andReturn(true)
                };
                scope.videoUrl = 'https://class.coursera.org/knowthyself-001/lecture/download.mp4?lecture_id=7'

                scope.submitVideo();
                expect(scope.videoStatus.error).toEqual(false);
                expect(doc.info.video).toEqual(scope.videoUrl);
                expect(analytics.pushAnalytics).toHaveBeenCalledWith('Video', scope.videoUrl);
                expect(scope.loadPlayer).toHaveBeenCalled();
            }));

            it('should call show tour when not ended and submitVideo', function () {
                scope.tour = {
                    ended: jasmine.createSpy('tour.ended').andReturn(false),
                    hideStep: jasmine.createSpy('tour.hideStep'),
                    showStep: jasmine.createSpy('tour.showStep')
                };

                scope.submitVideo();

                expect(scope.tour.ended).toHaveBeenCalled();
                expect(scope.tour.hideStep).toHaveBeenCalledWith(0);
                expect(scope.tour.showStep).toHaveBeenCalledWith(1);
            });

            it('should not call show tour when ended and submitVideo', function () {
                scope.tour = {
                    ended: jasmine.createSpy('tour.ended').andReturn(true),
                    hideStep: jasmine.createSpy('tour.hideStep'),
                    showStep: jasmine.createSpy('tour.showStep')
                };

                scope.submitVideo();

                expect(scope.tour.ended).toHaveBeenCalled();
                expect(scope.tour.hideStep).not.toHaveBeenCalled();
                expect(scope.tour.showStep).not.toHaveBeenCalled();
            });
        });

       it('should react to videoStateChange event', inject(function($rootScope, video) {
           spyOn(video, "isPlaying").andReturn(true);
           expect(scope.videoStatus.play).toBeFalsy();
           $rootScope.$broadcast('videoStateChange');
           expect(video.isPlaying).toHaveBeenCalled();
           expect(scope.videoStatus.play).toBeTruthy();
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
