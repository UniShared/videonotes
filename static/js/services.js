//Copyright (C) 2013 UniShared Inc.
//
//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var module = angular.module('app.services', [], ['$locationProvider', function ($locationProvider) {
    $locationProvider.html5Mode(true);
}]);

var ONE_HOUR_IN_MS = 1000 * 60 * 60;

// Http interceptor for error 401 (authorization)
module.factory('httpInterceptor401', ['$q', function ($q) {
    return function (promise) {
        return promise.then(function (response) {
            // do something on response 401
            return response;
        }, function (response) {
            if (response.status === 401) {
                window.location.href = response.data.redirectUri;
            }
            else {
                return $q.reject(response);
            }
        });
    };
}]);

module.config(['$httpProvider', function ($httpProvider) {
    $httpProvider.responseInterceptors.push('httpInterceptor401');
}]);

module.factory('config', ['$rootScope', '$http', 'appName', function ($rootScope, $http, appName) {
    return {
        appId: null,
        appName: null,
        googleAnalyticsAccount: null,
        load: function () {
            var promise = $http.get('/config');
            promise
                .then(angular.bind(this, this.setConfig),
                function () {
                    $rootScope.$broadcast('error', {
                        action: 'loadConfig',
                        message: 'An error occurred when loading the configuration'
                    })
                });
            return promise;
        },
        setConfig: function (response) {
            this.appName = appName;
            this.googleAnalyticsAccount = response.data.googleAnalyticsAccount;
            this.appId = response.data.appId;

            $rootScope.$broadcast('configLoaded', response.data);
        }
    };
}]);

// Shared model for current document
module.factory('doc',
    ['$rootScope', function ($rootScope) {
        var service = $rootScope.$new(true);
        service.dirty = false;
        service.lastSave = 0;
        service.timeSinceLastSave = function () {
            return new Date().getTime() - this.lastSave;
        };

        var initWatcher = function () {
            if (service.info && service.info.editable) {
                service.$watch('info',
                    function (newValue, oldValue) {
                        if (oldValue != null && newValue !== oldValue) {
                            service.dirty = true;
                        }
                    },
                    true);
            }
        };

        service.$on('firstSaved', initWatcher);
        service.$on('loaded', initWatcher);

        return service;
    }]);

module.factory('video', ['$rootScope', '$log', '$timeout', '$q', 'segmentio', function ($rootScope, $log, $timeout, $q, segmentio) {
    return {
        videoElement: null,
        player: null,
        videoUrl: null,
        subtitlesUrl: null,
        load: function () {
            if (this.videoUrl && this.videoElement) {
                var videoUrlToLoad = this.videoUrl;

                if (this.player) {
                    this.player.destroy();
                    $(this.videoElement).empty();
                    this.subtitlesUrl = null;
                }

                var matchVideoCoursera = this.getCourseLectureCoursera(this.videoUrl);
                if (matchVideoCoursera && matchVideoCoursera.length == 3) {
                    videoUrlToLoad = 'https://class.coursera.org/' + matchVideoCoursera[1] + '/lecture/download.mp4?lecture_id=' + matchVideoCoursera[2]
                    this.subtitlesUrl = 'https://class.coursera.org/' + matchVideoCoursera[1] + '/lecture/subtitles?q=' + matchVideoCoursera[2] + '_en&format=srt'
                }

                this.player = Popcorn.smart("#" + this.videoElement.id, videoUrlToLoad, {controls: true});
                this.bindEvents();

                this.player.controls(true);
                if (this.subtitlesUrl)
                    this.player.parseSRT('/proxy?q={0}'.format(encodeURIComponent(this.subtitlesUrl)));
            }
        },
        bindVideoPlayer: function (element) {
            $log.info("Bind video player to element", element.id);
            this.videoElement = element;
        },
        bindEvents: function () {
            var loadeddatafired = false;

            // Can't rely on player events because Firefox doesn't receive it
            $rootScope.$broadcast('video::loadstart');
            $timeout(function () {
                if (!loadeddatafired) {
                    $rootScope.$broadcast('video::loadeddata');
                }
            }, 5000);

            this.player.on("loadeddata", function () {
                $timeout(function () {
                    $rootScope.safeApply(function () {
                        $log.info("Player loadeddata");
                        loadeddatafired = true;
                        $rootScope.$broadcast('video::loadeddata');
                    });
                }, 1);
            });

            this.player.on("ratechange", function () {
                $timeout(function () {
                    $rootScope.safeApply(function () {
                        $log.info("Player ratechange");
                        $rootScope.$broadcast('video::ratechange');
                    });
                }, 1);
            });

            this.player.on("seeked", function () {
                $rootScope.safeApply(function () {
                    $log.info("Player seeked");
                    $rootScope.$broadcast('video::seeked');
                });
            });

            this.player.on("play", function () {
                $rootScope.safeApply(function () {
                    $log.info("Player play");
                    $rootScope.$broadcast('video::play');
                });
            });

            this.player.on("pause", function () {
                $rootScope.safeApply(function () {
                    $log.info("Player pause");
                    $rootScope.$broadcast('video::pause');
                });
            });

            this.player.on("error", function (e) {
                var message;
                switch (e.target.error.code) {
                    case e.target.error.MEDIA_ERR_ABORTED:
                        message = 'You aborted the video playback.';
                        break;
                    case e.target.error.MEDIA_ERR_NETWORK:
                        message = 'A network error caused the video download to fail part-way.';
                        break;
                    case e.target.error.MEDIA_ERR_DECODE:
                        message = 'The video playback was aborted due to a corruption problem or because the video used features your browser did not support.';
                        break;
                    case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        message = 'The video could not be loaded, either because the server or network failed or because the format is not supported.';
                        break;
                    default:
                        message = 'An unknown error occurred.';
                        break;
                }

                $rootScope.safeApply(function () {
                    $rootScope.$broadcast('video::error');

                    segmentio.track('Video load', {message:message});
                    $log.info("Error while loading the video", message);

                    $rootScope.$broadcast('error', {
                        action: 'load video',
                        message: 'An error occurred while loading the video'
                    });
                });
            });

            var _this = this;

            this.player.on('unstarted', function (event) {
                _this.videoUrl = _this.player.media.src;
                $rootScope.$broadcast('video::unstarted');
            });
        },
        getYoutubeVideoId: function (url) {
            var regex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/,
                match = url.match(regex);

            if (match && match[2].length == 11) {
                return match[2];
            } else {
                return null;
            }
        },
        getCourseLectureCoursera: function (url) {
            var regex = /^https:\/\/class.coursera.org\/([a-z0-9-]+)\/lecture\/(?:download\.mp4\?lecture_id=)?(\d+)$/;
            return url.match(regex);
        },
        play: function () {
            if (this.player)
                this.player.play();
        },
        pause: function () {
            if (this.player)
                this.player.pause();
        },
        isPlaying: function () {
            if (this.player) {
                return !this.player.paused();
            }
            else {
                return false;
            }
        },
        togglePlayPause: function () {
            this.isPlaying() ? this.pause() : this.play();
        },
        currentTime: function () {
            if (arguments.length && this.player.readyState() === 4) {
                segmentio.track('Jump', {time: arguments[0]});
                this.player.currentTime(arguments[0]);
            }
            else {
                return this.player.currentTime() || 0.01;
            }
        },
        canRatePlayback: function () {
            return this.player && this.player.media.canRatePlayback;
        },
        playbackRate: function () {
            if (arguments.length) {
                this.player.playbackRate(arguments[0]);
            }
            else {
                return this.player.playbackRate();
            }
        },
        takeSnapshot: function () {
            var dimensions = {
                top: this.videoElement.offsetTop,
                left: this.videoElement.offsetLeft,
                width: this.videoElement.offsetWidth,
                height: this.videoElement.offsetHeight
                },
                extensionEventDiv = document.getElementById('videonotesEventDiv'),
                customEvent = new CustomEvent('videonotes::getSnapshot', {detail: {dimensions: dimensions}}),
                defer = $q.defer();

            extensionEventDiv.addEventListener('videonotes::snapshotResult', function callback(result) {
                extensionEventDiv.removeEventListener(callback);
                defer.resolve(result.detail.snapshot);
                $rootScope.$apply();
            });
            extensionEventDiv.dispatchEvent(customEvent);

            return defer.promise;
        }
    };
}]);

module.factory('editor',
    ['$q', '$rootScope', '$log', '$timeout', 'doc', 'backend', 'video', function ($q, $rootScope, $log, $timeout, doc, backend, video) {
        var editor = null,
            EditSession = require("ace/edit_session").EditSession,
            service = $rootScope.$new(true);

        service.doc = doc;
        service.loading = false;
        service.loading = false;
        service.saving = false;
        service.savingErrors = 0;
        service.lastRow = -1;

        service.focusEditor = function () {
            editor && editor.focus();
        };

        service.rebind = function (element) {
            editor = ace.edit(element);
            editor.commands.removeCommand('splitline');
            editor.commands.removeCommand('golinedown');
            editor.on("gutterclick", function (e) {
                var lineCursorPosition = e.getDocumentPosition().row;

                if (doc.info.syncNotesVideo) {
                    service.jump(lineCursorPosition);
                }
            });
            service.updateEditor(doc.info);
        };

        service.snapshot = function () {
            doc.dirty = false;
            var data = angular.extend({}, doc.info);
            if (doc.info.editable) {
                data.content = doc.info.content;
            }
            return data;
        };
        service.create = function (parentId) {
            $log.info("Creating new doc");
            doc.dirty = true;

            service.updateEditor({
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
                parent: parentId || null
            });
        };
        service.copy = function (templateId) {
            $log.info("Copying template", templateId);
            backend.copy(templateId).then(angular.bind(service,
                function (result) {
                    doc.info.id = result.id;
                    $rootScope.$broadcast('copied', result.id);
                }),
                angular.bind(service, function () {
                    $log.warn("Error copying", templateId);
                    $rootScope.$broadcast('error', {
                        action: 'copy',
                        message: "An error occurred while copying the template"
                    });
                }));
        };
        service.load = function (id, reload) {
            $log.info("Loading resource", id, doc && doc.info && doc.info.id);
            if (!reload && doc.info && doc.info.id === id) {
                service.updateEditor(doc.info);
                return $q.when(doc.info);
            }
            service.loading = true;
            $rootScope.$broadcast('loading');
            return backend.load(id).then(
                function (result) {
                    service.loading = false;
                    service.updateEditor(result.data);
                    doc.info.id = id;
                    $rootScope.$broadcast('loaded', doc.info);
                    return result;
                },
                function (result) {
                    $log.warn("Error loading", result);
                    service.loading = false;
                    $rootScope.$broadcast('error', {
                        action: 'load',
                        message: "An error occured while loading the file"
                    });
                    return result;
                });
        };
        service.save = function (newRevision) {
            $log.info("Saving file", newRevision);
            if (service.saving || service.loading) {
                throw 'Save called from incorrect state';
            }
            service.saving = true;
            var file = service.snapshot();

            if (!doc.info.id) {
                $rootScope.$broadcast('firstSaving');
            }
            else {
                $rootScope.$broadcast('saving');
            }

            // Force revision if first save of the session
            newRevision = newRevision || doc.timeSinceLastSave() > ONE_HOUR_IN_MS;
            var promise = backend.save(file, newRevision);
            promise.then(
                function (result) {
                    $log.info("Saved file", result);
                    service.saving = false;
                    service.savingErrors = 0;

                    if (!doc.info.id) {
                        doc.info.id = result.data.id;
                        $rootScope.$broadcast('firstSaved', doc.info.id);
                    }

                    doc.lastSave = new Date().getTime();
                    $rootScope.$broadcast('saved', doc.info);
                    return doc.info;
                },
                function (result) {
                    service.saving = false;
                    service.savingErrors++;
                    doc.dirty = true;

                    if (service.savingErrors === 5) {
                        doc.info.editable = false;
                        $rootScope.$broadcast('error', {
                            action: 'save',
                            message: "Too many errors occurred while saving the file. Please contact us"
                        });
                    }
                    else if(result.status === 403) {
                        doc.info.editable = false;
                        $rootScope.$broadcast('error', {
                            action: 'save',
                            message: "You are not authorized to save or update this file. Please contact us"
                        });
                    }
                    else {
                        $rootScope.$broadcast('error', {
                            action: 'save',
                            message: "An error occurred while saving the file"
                        });
                    }

                    return result;
                });
            return promise;
        };

        service.jump = function (line) {
            var timestamp, videoUrl;

            for(var sync in doc.info.videos) {
                if(doc.info.videos[sync][line]) {
                    timestamp = doc.info.videos[sync][line]['time'];
                    videoUrl = sync;
                    break;
                }
            }

            if (typeof timestamp !== "undefined" && typeof videoUrl !== "undefined") {
                $log.info('Timestamp', line, timestamp);
                if (timestamp > -1) {
                    if(video.videoUrl !== videoUrl) {
                        doc.info.currentVideo = videoUrl;
                        video.videoUrl = doc.info.currentVideo;
                        video.load();
                        var offListener = service.$on('video::loadeddata', function () {
                            video.currentTime(timestamp);
                            offListener();
                        });
                    }
                    else {
                        video.currentTime(timestamp);
                    }

                    editor.gotoLine(line+1);
                    editor.navigateLineEnd();
                }
            }
            else {
                $log.info('No timestamp');
            }
        };

        service.updateEditor = function (fileInfo) {
            if (!fileInfo) {
                return;
            }

            $log.info("Updating editor", fileInfo);

            var session = new EditSession(fileInfo.content);
            session.setUseWrapMode(true);
            session.setWrapLimitRange(80);

            session.on('change', function () {
                if (doc && doc.info) {
                    $rootScope.safeApply(function () {
                        doc.info.content = session.getValue();
                    });
                }
            });

            session.$breakpointListener = function (e) {
                var currentSync = service.getCurrentSync();
                if (!doc.info || !currentSync)
                    return;
                var delta = e.data;
                var range = delta.range;
                if (range.end.row == range.start.row) {
                    // Removing sync mark if line is now empty
                    if (session.getLine(range.start.row).trim() === '') {
                        service.unsync(range.start.row);
                    }
                    else if (!(range.start.row in currentSync)) {
                        service.syncLine(range.start.row, true);
                    }

                    return;
                }

                var firstRow, shift;
                if (delta.action == "insertText") {
                    firstRow = range.start.column ? range.start.row + 1 : range.start.row;
                    shift = 1;
                }
                else {
                    firstRow = range.start.row;
                    shift = -1;
                }

                var shiftedSyncNotesVideo = {};
                for (var line in currentSync) {
                    var intLine = parseInt(line);
                    if (!isNaN(intLine)) {
                        if (line < firstRow) {
                            shiftedSyncNotesVideo[line] = currentSync[line];
                        }
                        else {
                            var nextLine = parseInt(line) + shift;
                            shiftedSyncNotesVideo[nextLine] = currentSync[line];
                        }
                    }
                }
                doc.info.videos[doc.info.currentVideo] = shiftedSyncNotesVideo;

                service.updateBreakpoints();
            }.bind(session);
            session.on("change", session.$breakpointListener);

            session.getSelection().on('changeCursor', function (e) {
                var lineCursorPosition = editor.getCursorPosition().row;

                if (lineCursorPosition != service.lastRow) {
                    service.lastRow = lineCursorPosition;

                    if (doc.info.syncNotesVideo) {
                        service.jump(service.lastRow);
                    }
                }
            });

            if(editor) {
                editor.setSession(session);
                editor.focus();
            }

            doc.lastSave = 0;
            doc.info = fileInfo;

            service.updateBreakpoints();
            service.jump(0);
        };
        service.updateBreakpoints = function () {
            if (doc.info) {
                var session = editor.getSession(),
                    annotations = [],
                    breakpoints = [];

                session.clearBreakpoints();
                for(var sync in doc.info.videos) {
                    for (var line in doc.info.videos[sync]) {
                        var timestamp = parseFloat(doc.info.videos[sync][line].time);
                        if (timestamp > -1)
                        {
                            var minutes = parseInt(timestamp / 60, 10) % 60,
                                seconds = ("0" + parseInt(timestamp % 60, 10)).slice(-2);

                            breakpoints.push(line);
                            annotations.push({row:line, text:
                                '{0}:{1}'.format(minutes, seconds)});
                        }
                    }
                }

                session.setBreakpoints(breakpoints);
                session.setAnnotations(annotations);
            }
        };

        service.getCurrentSync = function (line) {
            if (doc.info.currentVideo) {
                var currentSync = doc.info.videos[doc.info.currentVideo];
                if (undefined != line) {
                    if(!currentSync[line]) {
                        currentSync[line] = {
                            time: null
                        };
                    }

                    return currentSync[line];
                }

                return doc.info.videos[doc.info.currentVideo];
            }
        };

        service.syncLine = function (line, shift) {
            // Is there a video loaded?
            var currentSync = service.getCurrentSync(),
                currentSyncLine = service.getCurrentSync(line),
                currentTime = video.currentTime();

            if (doc.info && doc.info.currentVideo) {
                $log.info('Video loaded');

                // Is there some texts before and after?
                var timestampBefore, isLineBefore = false,
                    timestampAfter, isLineAfter = false;

                for (var lineSynced in currentSync) {
                    if (!isLineBefore && lineSynced < line) {
                        isLineBefore = true;
                        timestampBefore = currentSync[lineSynced].time;
                    }
                    else if (!isLineAfter && lineSynced > line) {
                        isLineAfter = true;
                        timestampAfter = currentSync[lineSynced].time;
                    }

                    if (isLineBefore && isLineAfter) {
                        break;
                    }
                }

                if (isLineBefore && isLineAfter && (currentTime < timestampBefore || currentTime > timestampAfter)) {
                    // Text before and after and video currently further (refactoring mode)
                    // Timestamp for this line must be average time between nearest line before/after
                    currentSyncLine.time = (timestampBefore + timestampAfter) / 2;
                }
                else {
                    // No text or only before / after
                    // Using current player time minus a delta
                    if(shift) {
                        if(parseInt(currentTime - 3, 10) > 0) {
                            currentSyncLine.time = currentTime - 3;
                        }
                        else {
                            currentSyncLine.time = currentTime - currentTime;
                        }
                    }
                    else {
                        currentSyncLine.time = currentTime;
                    }
                }

                $log.info('Setting timestamp', line, currentSyncLine.time);
                this.updateBreakpoints();
            }
            // No video => mark it anyway, don't want to sync this line
            else {
                $log.info('No video');
                currentSyncLine.time = -1
            }
        };

        service.setSnapshot = function (snapshot) {
            var lineCursorPosition = editor.getCursorPosition().row,
                currentSync = service.getCurrentSync(lineCursorPosition),
                snapshotSymbol = '<snapshot>',
                session = editor.getSession();

            if(session.getLine(lineCursorPosition).indexOf(snapshotSymbol) === -1) {
                session.insert({row:lineCursorPosition, column:0}, snapshotSymbol + '\n');
                service.syncLine(lineCursorPosition, false);
                editor.focus();
            }

            currentSync.snapshot = snapshot;
        };

        service.unsync = function (line) {
            var currentSync = service.getCurrentSync(line),
                session = editor.getSession();

            if (doc.info && currentSync) {
                delete doc.info.videos[doc.info.currentVideo][line];
                service.updateBreakpoints();
            }
        };

        service.state = function () {
            if (service.loading) {
                return EditorState.LOAD;
            } else if (service.saving) {
                return EditorState.SAVE;
            } else if (doc.info && !doc.info.editable) {
                return EditorState.READONLY;
            }
            else if (doc.dirty) {
                return EditorState.DIRTY;
            }
            return EditorState.CLEAN;
        };

        service.$on('video::seeked', function () {
            service.focusEditor();
        });
        service.$on('video::ratechange', function () {
            service.focusEditor();
        });
        service.$on('video::play', function () {
            service.focusEditor();
        });
        service.$on('video::pause', function () {
            service.focusEditor();
        });
        service.$on('saving', function () {
            service.focusEditor();
        });
        service.$on('loading', function () {
            service.focusEditor();
        });

        service.$watch('doc.info.syncVideoNotes', function () {
            service.focusEditor();
        });

        service.$watch('doc.info.editable', function (newValue, oldValue) {
            if (editor && newValue !== oldValue) {
                editor.setReadOnly(!newValue);
            }
        });

        return service;
    }]);

module.factory('backend',
    ['$http', '$rootScope', '$log', '$q', 'doc', function ($http, $rootScope, $log, $q, doc) {
        var jsonTransform = function (data, headers) {
            return angular.fromJson(data);
        };

        var clientId, channel,
            socket;

        var service = {
            user: function () {
                return $http.get('/user');
            },
            about: function () {
                return $http.get('/about');
            },
            copy: function (templateId) {
                return $http.post('/svc', {
                    templateId: templateId
                });
            },
            load: function (id) {
                return $http.get('/svc', {
                    params: {
                        'file_id': id
                    }
                });
            },
            save: function (fileInfo, newRevision) {
                $log.info('Saving', fileInfo);

                return $http({
                    url: '/svc',
                    method: doc.info.id ? 'PUT' : 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    params: {
                        'newRevision': newRevision
                    },
                    data: JSON.stringify(fileInfo)
                });
            }
        };

        return service;
    }]);

module.factory('user', ['$rootScope', 'backend', 'segmentio', function ($rootScope, backend, segmentio) {
    var _this = this;
    this.authenticated = false;
    this.info = null;

    return {
        isAuthenticated: function () {
            return _this.authenticated;
        },
        getInfo: function () {
            return _this.info;
        },
        login: function () {
            var promise = backend.user();
            promise.then(function (response) {
                _this.authenticated = true;
                _this.info = response.data;
                segmentio.identify(_this.info.email);
                $rootScope.$broadcast('authentified', _this);
            });

            return promise;
        }
    };
}]);

module.factory('autosaver',
    ['$rootScope', '$window', 'user', 'editor', 'doc', 'saveInterval', '$timeout', function ($rootScope, $window, user, editor, doc, saveInterval, $timeout) {

        var service = $rootScope.$new(true);
        service.doc = doc;
        service.confirmOnLeave = function (e) {
            if (user.isAuthenticated() && doc.dirty) {
                var msg = "You have unsaved data.";

                // For IE and Firefox
                e = e || window.event;
                if (e) {
                    e.returnValue = msg;
                }

                // For Chrome and Safari
                return msg;
            }

        };
        $window.addEventListener('beforeunload', service.confirmOnLeave);

        service.saveFn = function () {
            if (editor.state() == EditorState.DIRTY) {
                editor.save(false);
            }
        };

        var initTimeout = function () {
            if (doc.info && doc.info.editable) {
                var createTimeout = function () {
                    return $timeout(service.saveFn, saveInterval).then(createTimeout);
                };

                createTimeout();
            }
        };

        service.$on('firstSaved', initTimeout);
        service.$on('loaded', initTimeout);

        return service;
    }]);