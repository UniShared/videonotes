'use strict';

/* jasmine specs for services go here */

describe('service', function() {
    beforeEach(function () {
        angular.module('appMock', [])
            .constant('saveInterval', 5000)
            .constant('appName', "VideoNotes test");
        angular.mock.module('app.services', 'segmentio', 'appMock');
    });

    beforeEach(angular.mock.inject(function($window, backend) {
        $window.addEventListener = jasmine.createSpy();
    }));

    describe('editor', function () {
        var deffered;

        beforeEach(inject(function (doc, backend) {
            doc.info = {
                content: '',
                video: null,
                syncNotesVideo: {
                    enabled: true
                },
                labels: {
                    starred: false
                },
                editable: true,
                title: 'Untitled notes',
                description: '',
                mimeType: 'application/vnd.unishared.document',
                parent: null
            };
        }));

        describe('events', function () {
            it('should listen to video::seeked', inject(function ($rootScope, editor) {
                spyOn(editor, "focusEditor");

                $rootScope.$broadcast('video::seeked');
                $rootScope.$apply();

                expect(editor.focusEditor).toHaveBeenCalled();
            }));

            it('should listen to video::ratechange', inject(function ($rootScope,editor) {
                spyOn(editor, "focusEditor");

                $rootScope.$broadcast('video::ratechange');
                $rootScope.$apply();

                expect(editor.focusEditor).toHaveBeenCalled();
            }));

            it('should listen to video::play', inject(function ($rootScope,editor) {
                spyOn(editor, "focusEditor");

                $rootScope.$broadcast('video::play');
                $rootScope.$apply();

                expect(editor.focusEditor).toHaveBeenCalled();
            }));

            it('should listen to video::pause', inject(function ($rootScope, editor) {
                spyOn(editor, "focusEditor");

                $rootScope.$broadcast('video::pause');
                $rootScope.$apply();

                expect(editor.focusEditor).toHaveBeenCalled();
            }));

            it('should listen to saving', inject(function ($rootScope, editor) {
                spyOn(editor, "focusEditor");

                $rootScope.$broadcast('saving');
                $rootScope.$apply();

                expect(editor.focusEditor).toHaveBeenCalled();
            }));

            it('should listen to loading', inject(function ($rootScope, editor) {
                spyOn(editor, "focusEditor");

                $rootScope.$broadcast('loading');
                $rootScope.$apply();

                expect(editor.focusEditor).toHaveBeenCalled();
            }));

            it('should watch doc.info.syncNotesVideo.enabled', inject(function ($rootScope, editor, doc) {
                spyOn(editor, "focusEditor");

                $rootScope.$apply();
                doc.info.syncNotesVideo.enabled = false;
                $rootScope.$apply();

                expect(editor.focusEditor).toHaveBeenCalled();
            }));
        });

        describe('create method', function () {
            it('should create a version 2 document', inject(function (doc, editor) {
                editor.create();

                expect(doc.info).toEqual({
                    version: 2,
                    content: '',
                    currentVideo: null,
                    videos: {},
                    syncNotesVideo: true,
                    labels: {
                        starred: false
                    },
                    editable: true,
                    title: 'Untitled notes',
                    description: '',
                    mimeType: 'application/vnd.unishared.document',
                    parent: null
                });
            }));
        });

        describe('save method', function () {
            var mockSnapshot = {},
                resolveResponse = {
                    status: 200,
                    data:
                    {
                        id: 'test'
                    }
                };

            beforeEach(inject(function ($rootScope, $q, backend, editor) {
                spyOn($rootScope, '$broadcast').andCallThrough();
                editor.snapshot = jasmine.createSpy().andReturn(mockSnapshot);
                backend.save = jasmine.createSpy().andCallFake(function () {
                    deffered = $q.defer();
                    return deffered.promise;
                });
            }));

            it('should get a snapshot and send it to the backend for a new revision', inject(function (editor, backend) {
                editor.save();
                expect(editor.snapshot).toHaveBeenCalled();
                expect(backend.save).toHaveBeenCalledWith(mockSnapshot, true);
            }));

            it('should force a new revision only on first save', inject(function ($rootScope, editor, backend) {
                editor.save();
                expect(editor.snapshot).toHaveBeenCalled();
                expect(backend.save).toHaveBeenCalledWith(mockSnapshot, true);
                deffered.resolve(resolveResponse);
                $rootScope.$digest();

                editor.save();
                expect(backend.save).toHaveBeenCalledWith(mockSnapshot, false);
                deffered.resolve(resolveResponse);
            }));

            it('should fire firstSaving event if no id', inject(function ($rootScope, editor, doc) {
                expect(doc.info.id).toEqual(null);

                editor.save();

                expect($rootScope.$broadcast).toHaveBeenCalledWith('firstSaving');
            }));

            it('should assign document id on success', inject(function ($rootScope, editor, doc) {
                expect(doc.info.id).toEqual(null);

                editor.save();
                deffered.resolve(resolveResponse);
                $rootScope.$digest();
                expect(doc.info.id).toEqual('test');
            }));

            it('should fire firstSaved event on success', inject(function ($rootScope, editor, doc) {
                editor.save();
                deffered.resolve(resolveResponse);
                $rootScope.$digest();
                expect($rootScope.$broadcast).toHaveBeenCalledWith('firstSaved', 'test');
            }));

            it('should store saving errors', inject(function ($rootScope, editor, doc) {
                expect(editor.savingErrors).toEqual(0);

                editor.save();
                deffered.reject({status:500});
                $rootScope.$digest();

                expect(doc.dirty).toEqual(true);
                expect(editor.savingErrors).toEqual(1);
            }));

            it('should store restore error counter to zero when success', inject(function ($rootScope, editor) {
                expect(editor.savingErrors).toEqual(0);

                editor.save();
                deffered.reject({status:500});
                $rootScope.$digest();
                expect(editor.savingErrors).toEqual(1);

                editor.save();
                deffered.resolve(resolveResponse);
                $rootScope.$digest();
                expect(editor.savingErrors).toEqual(0);
            }));

            it('should make document not editable after 5 saving errors', inject(function ($rootScope, editor, doc, backend) {
                expect(editor.savingErrors).toEqual(0);

                var i;
                for(i=0;i<5;i++) {
                    editor.save();
                    deffered.reject({status:500});
                    $rootScope.$digest();
                    expect($rootScope.$broadcast).toHaveBeenCalledWith('error', {
                        action: 'save',
                        message: "An error occurred while saving the file"
                    });
                }

                expect(editor.savingErrors).toEqual(i);
                expect(backend.save.callCount).toEqual(i);
                expect(doc.info.editable).toBeFalsy();
                expect($rootScope.$broadcast).toHaveBeenCalledWith('error', {
                    action: 'save',
                    message: "Too many errors occurred while saving the file. Please contact us"
                });
            }));
        });

        describe('jump', function () {
            beforeEach(inject(function (doc) {
                doc.info = {
                    syncNotesVideo: true,
                    currentVideo: 'a',
                    videos: {
                        'a': {
                            0: 1
                        },
                        'b': {
                            1: 2
                        }
                    }
                };
            }));

            it('should not jump when sync disabled', inject(function (doc, editor) {
                doc.info.syncNotesVideo = false;
                editor.jump(1);
                expect(doc.info.currentVideo).toEqual('a');
            }));

            it('should change the current video if current line is sync with a different one', inject(function (doc, editor) {
                editor.jump(1);
                expect(doc.info.currentVideo).toEqual('b');
            }));
        });
    });

    describe('video', function () {
        var mockPopcorn;
        beforeEach(function () {
            mockPopcorn = {
                controls: jasmine.createSpy('Popcorn.controls'),
                destroy: jasmine.createSpy('destroy'),
                parseSRT:jasmine.createSpy('parseSRT')
            };
            spyOn(Popcorn, 'smart').andReturn(mockPopcorn);
        });

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

        it("should have a load method calling Popcorn JS", inject(function(video) {
            video.bindEvents = jasmine.createSpy('bindEvents');
            video.videoUrl = 'https://class.coursera.org/knowthyself-001/lecture/download.mp4?lecture_id=7';
            video.videoElement = {
                id:"testplayer"
            };

            video.load();

            expect(Popcorn.smart).toHaveBeenCalledWith("#{0}".format(video.videoElement.id), video.videoUrl, {controls:true});
            expect(video.bindEvents).toHaveBeenCalled();
            expect(video.subtitlesUrl).not.toEqual(null);
            expect(mockPopcorn.parseSRT).toHaveBeenCalledWith('/proxy?q={0}'.format(encodeURIComponent(video.subtitlesUrl)));

            video.videoUrl = 'https://class.videonotes.org/knowthyself-001/lecture/download.mp4?lecture_id=7';
            video.load();

            expect(mockPopcorn.destroy).toHaveBeenCalled();
            expect(video.subtitlesUrl).toEqual(null);
        }));

        it('should have a togglePlayPause which play the video when not playing', inject(function (video) {
            spyOn(video, "play");
            spyOn(video, "pause");

            spyOn(video, "isPlaying").andReturn(false);
            video.togglePlayPause();

            expect(video.isPlaying).toHaveBeenCalled();
            expect(video.play).toHaveBeenCalled();
            expect(video.pause).not.toHaveBeenCalled();
        }));

        it('should have a togglePlayPause which pause the video when  playing', inject(function (video) {
            spyOn(video, "play");
            spyOn(video, "pause");

            spyOn(video, "isPlaying").andReturn(true);
            video.togglePlayPause();

            expect(video.isPlaying).toHaveBeenCalled();
            expect(video.pause).toHaveBeenCalled();
            expect(video.play).not.toHaveBeenCalled();
        }));

        describe('takeSnapshot', function () {
            var eventDiv;
            beforeEach(inject(function (video) {
                eventDiv = document.createElement('div');
                eventDiv.id = 'videonotesEventDiv';
                document.body.appendChild(eventDiv);

                video.videoElement = document.createElement('div');
                document.body.appendChild(video.videoElement);
            }));

            afterEach(inject(function (video) {
                eventDiv.parentNode.removeChild(eventDiv);
                video.videoElement.parentNode.removeChild(video.videoElement);
            }));

            it('should send a getSnapshot event', inject(function (video) {
                var callback = jasmine.createSpy();
                eventDiv.addEventListener('videonotes::getSnapshot', callback);

                video.takeSnapshot();

                waitsFor(function() {
                    return callback.callCount > 0;
                }, "getSnapshot callback to have been called", 1000);

                runs(function () {
                    expect(callback).toHaveBeenCalled();
                });

                eventDiv.removeEventListener('videonotes::getSnapshot', callback);
            }));

            it('should return a promise called with the snapshot', inject(function ($rootScope, video) {
                var callbackPromise = jasmine.createSpy(),
                    snapshotResult = {detail: {snapshot: 'snapshot'}};

                eventDiv.addEventListener('videonotes::getSnapshot', function callback() {
                    eventDiv.removeEventListener('videonotes::getSnapshot', callback);
                    var customEvent = new CustomEvent('videonotes::snapshotResult', snapshotResult);
                    eventDiv.dispatchEvent(customEvent);
                });

                var promiseSnapshot = video.takeSnapshot();
                promiseSnapshot.then(callbackPromise);

                waitsFor(function() {
                    $rootScope.$digest();
                    return callbackPromise.callCount > 0;
                }, "Promise snapshot callback to have been called", 1000);

                runs(function () {
                    expect(callbackPromise).toHaveBeenCalledWith('snapshot');
                })
            }));
        });
    });

    describe('config', function () {
        it('should have a load method', inject(function (config){
            expect(config.load).toBeDefined();
        }));

        it('should call the config endpoint on load call', inject(function ($httpBackend, config) {
            var response = {segmentio:'test', appId: '1234'};
            $httpBackend.expectGET('/config').respond(200, response);

            config.load();

            $httpBackend.flush();
        }));
    });

    describe('autosaver', function () {
        it('should check document state each saveInterval seconds', inject(function ($rootScope, $timeout, autosaver, doc) {
            spyOn(autosaver, 'saveFn');
            doc.info = {editable: true};
            $rootScope.$broadcast('loaded');

            $timeout.flush();
            expect(autosaver.saveFn).toHaveBeenCalled();
        }));

        it('should have a confirmOnLeave method which is returning a message when user is authenfied', inject(function (doc, autosaver, user) {
            expect(typeof autosaver.confirmOnLeave).toBe('function');
            spyOn(user, 'isAuthenticated').andReturn(true);
            doc.dirty = true;

            var msgExpected = "You have unsaved data.",
                msgReturned = autosaver.confirmOnLeave();
            expect(msgExpected).toEqual(msgReturned);
        }));

        it('should listen to beforeunload event', inject(function ($window, autosaver, doc, user) {
            spyOn(user, "isAuthenticated").andReturn(true);
            autosaver.$apply(function () {
                doc.dirty = true;
            });

            var msg = $window.addEventListener.mostRecentCall.args[1]({});
            expect(msg).toEqual("You have unsaved data.");
        }));
    });

    afterEach(inject(function($httpBackend) {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    }));
});
