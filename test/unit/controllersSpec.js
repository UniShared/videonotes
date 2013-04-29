'use strict';

/* jasmine specs for controllers go here */

describe('Controllers', function () {
    var scope;

    beforeEach(angular.mock.module('app', 'analytics'));

    beforeEach(angular.mock.inject(function($rootScope, $window, analytics) {
        scope = $rootScope.$new();
        scope.tour = {
            next: function () {}
        };
        analytics.pushAnalytics = jasmine.createSpy('pushAnalytics');
        spyOn(scope, '$on').andCallThrough();
        $window.addEventListener = jasmine.createSpy();
    }));


    describe('VideoCtrl', function () {
        var videoCtrl;

        beforeEach(angular.mock.inject(function ($rootScope, $controller, doc, video) {
            doc.info = {};

            var playing = false;
            video.load = jasmine.createSpy();
            video.togglePlayPause = jasmine.createSpy().andCallFake(function () {playing=!playing});
            video.isPlaying = jasmine.createSpy().andCallFake(function () {return playing});

            videoCtrl = $controller('VideoCtrl', {$scope: scope});
        }));

        it('should be defined', function () {
            expect(videoCtrl).not.toEqual(null);
            expect(scope).not.toEqual(null);

            expect(scope.videoUrl).toEqual(null);
            expect(scope.doc).toBeDefined();
        });

        it('should listen for shortcuts event', angular.mock.inject(function () {
            expect(scope.$on).toHaveBeenCalledWith('shortcut', jasmine.any(Function));
        }));

        it('should listen for loaded event', angular.mock.inject(function () {
            expect(scope.$on).toHaveBeenCalledWith('loaded', scope.loadPlayer);
        }));

        it('should listen for video::loadeddata event', angular.mock.inject(function () {
            expect(scope.$on).toHaveBeenCalledWith('video::loadeddata', scope.endLoading);
        }));

        it('should listen for video::error event', angular.mock.inject(function () {
            expect(scope.$on).toHaveBeenCalledWith('video::error', scope.errorLoadVideo);
        }));

        it('should be able to play/pause video', angular.mock.inject(function (analytics, video) {
            expect(scope.playPauseVideo).toBeDefined();
            expect(scope.doc).toBeDefined();

            scope.doc.info = {
                video: 'http://video.unishared.com/test.mp4'
            };

            scope.playPauseVideo();

            expect(analytics.pushAnalytics.mostRecentCall.args).toEqual(['Video', 'play pause', 'play']);
            expect(video.isPlaying).toHaveBeenCalled();

            scope.playPauseVideo();

            expect(analytics.pushAnalytics.mostRecentCall.args).toEqual(['Video', 'play pause', 'pause']);
            expect(video.togglePlayPause.callCount).toEqual(2);
        }));

        it('has a loadPlayer method', angular.mock.inject(function (video) {
            expect(scope.loading).toBeUndefined();

            video.load = jasmine.createSpy('load');
            spyOn(scope, 'endLoading').andCallThrough();

            scope.doc.info = {
                video: 'https://class.coursera.org/knowthyself-001/lecture/download.mp4?lecture_id=7'
            };

            scope.loadPlayer();

            expect(video.videoUrl).toEqual(scope.doc.info.video);
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

        it('should have a endLoading method', angular.mock.inject(function () {
            scope.loading = true;
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
    });

    describe('SpeedCtrl', function () {
        var speedCtrl;

        beforeEach(angular.mock.inject(function ($rootScope, $controller) {
            speedCtrl = $controller('SpeedCtrl', {$scope: scope});
        }));

        it('should start with default values', function () {
            expect(scope.enabled).toBeFalsy();
            expect(scope.minSpeed).toBeFalsy();
            expect(scope.maxSpeed).toBeFalsy();
            expect(scope.currentSpeed).toEqual(1);
        });

        it('should be able to increase playback rate', inject(function (analytics) {
            expect(scope.currentSpeed).toEqual(1);
            scope.increasePlaybackRate();
            expect(scope.currentSpeed).toEqual(1.5);
            expect(scope.maxSpeed).toBeFalsy();
            expect(scope.minSpeed).toBeFalsy();
            expect(analytics.pushAnalytics).toHaveBeenCalledWith('Video', 'increase speed', scope.currentSpeed);
        }));

        it('should have a max speed', inject(function (analytics) {
            expect(scope.currentSpeed).toEqual(1);
            scope.increasePlaybackRate();
            expect(scope.currentSpeed).toEqual(1.5);
            scope.increasePlaybackRate();
            expect(scope.currentSpeed).toEqual(scope.speeds[scope.speeds.length-1]);
            expect(scope.maxSpeed).toBeTruthy();
            expect(scope.minSpeed).toBeFalsy();
        }));

        it('should be able to decrease playback rate', inject(function (analytics) {
            expect(scope.currentSpeed).toEqual(1);
            scope.decreasePlaybackRate();
            expect(scope.currentSpeed).toEqual(0.5);
            expect(scope.maxSpeed).toBeFalsy();
            expect(scope.minSpeed).toBeFalsy();
            expect(analytics.pushAnalytics).toHaveBeenCalledWith('Video', 'decrease speed', scope.currentSpeed);
        }));

        it('should have a min speed', inject(function (analytics) {
            expect(scope.currentSpeed).toEqual(1);
            scope.decreasePlaybackRate();
            expect(scope.currentSpeed).toEqual(0.5);
            scope.decreasePlaybackRate();
            expect(scope.currentSpeed).toEqual(scope.speeds[0]);
            expect(scope.maxSpeed).toBeFalsy();
            expect(scope.minSpeed).toBeTruthy();
        }));

        it('should listen to video::loadstart event', function () {
            expect(scope.$on).toHaveBeenCalledWith('video::loadstart', jasmine.any(Function));
        });

        it('should listen to video::ratechange event', inject(function ($rootScope, video) {
            expect(scope.$on).toHaveBeenCalledWith('video::ratechange', jasmine.any(Function));

            expect(scope.currentSpeed).toEqual(1);
            spyOn(video, "playbackRate").andReturn(2);
            $rootScope.$broadcast('video::ratechange');
            expect(scope.currentSpeed).toEqual(2);
        }));

        it('should listen to video::loadeddata event', inject(function ($rootScope, video) {
            spyOn(scope, "$watch");
            expect(scope.$on).toHaveBeenCalledWith('video::loadeddata', jasmine.any(Function));

            expect(scope.enabled).toBeFalsy();
            spyOn(video, "canRatePlayback").andReturn(true);
            $rootScope.$broadcast('video::loadeddata');
            expect(scope.enabled).toBeTruthy();
            expect(scope.$watch).toHaveBeenCalledWith('currentSpeed', jasmine.any(Function));
        }));

        it('should change playback in video service', inject(function ($rootScope, video) {
            spyOn(video, "playbackRate");
            spyOn(video, "canRatePlayback").andReturn(true);
            $rootScope.$broadcast('video::loadeddata');

            expect(scope.enabled).toBeTruthy();
            scope.currentSpeed = 0;
            scope.$digest();
            /*waitsFor(function() {
                return video.playbackRate.wasCalled;
            }, "Playback rate have been called", 10000);
            expect(video.playbackRate).toHaveBeenCalledWith(scope.currentSpeed);*/
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
