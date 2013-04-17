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

module.factory('config', ['$http', function ($http) {
    return {
        load: function () {
            return $http.get('/config');
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
        service.$watch('info',
            function (newValue, oldValue) {
                if (oldValue != null && newValue !== oldValue) {
                    service.dirty = true;
                }
            },
            true);

        return service;
    }]);

module.factory('video', ['$rootScope', '$log', 'analytics', function ($rootScope, $log, analytics) {
    return {
        player: null,
        videoUrl: null,
        load: function () {
            if (this.videoUrl) {
                this.player.src = this.videoUrl;
                this.player.load();
            }
        },
        bindVideoPlayer: function (element) {
            $log.info("Bind video player to element", element.id);
            this.player = element;
            this.player.addEventListener("canplay", function () {
                $rootScope.$broadcast('videoLoaded');
            }, false);

            this.player.addEventListener("error", function (e) {
                $rootScope.$broadcast('videoError');

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

                analytics.pushAnalytics('Video', 'load', message);
                $log.info("Error while loading the video", message);

                $rootScope.$broadcast('error', {
                    action: 'load video',
                    message: 'An error occurred while loading the video'
                });
            }, false);
        }
    };
}]);

module.factory('editor',
    ['doc', 'backend', 'youtubePlayerApi', 'video', '$q', '$rootScope', '$log', function (doc, backend, youtubePlayerApi, video, $q, $rootScope, $log) {
        var editor = null;
        var EditSession = require("ace/edit_session").EditSession;

        // Disable all editor shortcuts

        var service = {
            loading: false,
            saving: false,
            lastRow: -1,
            rebind: function (element) {
                editor = ace.edit(element);
                editor.commands.removeCommand('splitline');
                editor.commands.removeCommand('golinedown');
                editor.on("gutterclick", function (e) {
                    if (doc.info.syncNotesVideo.enabled) {
                        var lineCursorPosition = e.getDocumentPosition().row,
                            timestamp = doc.info.syncNotesVideo[lineCursorPosition];

                        if (youtubePlayerApi.player) {
                            youtubePlayerApi.player.seekTo(timestamp);
                        }
                        else if (video.player) {
                            video.player.currentTime = timestamp;
                        }
                    }

                });
                this.updateEditor(doc.info);
            },

            snapshot: function () {
                doc.dirty = false;
                var data = angular.extend({}, doc.info);
                if (doc.info.editable) {
                    data.content = doc.info.content;
                }
                return data;
            },
            create: function (parentId) {
                $log.info("Creating new doc");
                doc.dirty = false;

                this.updateEditor({
                    id: null,
                    content: '',
                    video: null,
                    syncNotesVideo: {
                        enabled: true
                    },
                    labels: {
                        starred: false
                    },
                    editable: true,
                    title: 'Your notes',
                    description: '',
                    mimeType: 'application/vnd.unishared.document',
                    parent: parentId || null
                });
            },
            copy: function (templateId) {
                $log.info("Copying template", templateId);
                backend.copy(templateId).then(angular.bind(this,
                    function (result) {
                        doc.info.id = result.data.id;
                        $rootScope.$broadcast('copied', result.data.id);
                    }),
                    angular.bind(this, function () {
                        $log.warn("Error copying", templateId);
                        $rootScope.$broadcast('error', {
                            action: 'copy',
                            message: "An error occurred while copying the template"
                        });
                    }));
            },
            load: function (id, reload) {
                $log.info("Loading resource", id, doc.info && doc.info.id);
                if (!reload && doc.info && id == doc.info.id) {
                    this.updateEditor(doc.info);
                    return $q.when(doc.info);
                }
                this.loading = true;
                $rootScope.$broadcast('loading');
                return backend.load(id).then(angular.bind(this,
                    function (result) {
                        this.loading = false;
                        this.updateEditor(result.data);
                        $rootScope.$broadcast('loaded', doc.info);
                        return result;
                    }), angular.bind(this,
                    function (result) {
                        $log.warn("Error loading", result);
                        this.loading = false;
                        $rootScope.$broadcast('error', {
                            action: 'load',
                            message: "An error occured while loading the file"
                        });
                        return result;
                    }));
            },
            save: function (newRevision) {
                $log.info("Saving file", newRevision);
                if (this.saving || this.loading) {
                    throw 'Save called from incorrect state';
                }
                this.saving = true;
                var file = this.snapshot();

                if (!doc.info.id) {
                    $rootScope.$broadcast('firstSaving');
                }

                // Force revision if first save of the session
                newRevision = newRevision || doc.timeSinceLastSave() > ONE_HOUR_IN_MS;
                var promise = backend.save(file, newRevision);
                promise.then(angular.bind(this,
                    function (result) {
                        $log.info("Saved file", result);
                        this.saving = false;

                        if (!doc.info.id) {
                            doc.info.id = result.data.id;
                            $rootScope.$broadcast('firstSaved', doc.info.id);
                        }

                        doc.lastSave = new Date().getTime();
                        $rootScope.$broadcast('saved', doc.info);
                        return doc.info;
                    }), angular.bind(this,
                    function (result) {
                        this.saving = false;
                        doc.dirty = true;
                        $rootScope.$broadcast('error', {
                            action: 'save',
                            message: "An error occurred while saving the file"
                        });
                        return result;
                    }));
                return promise;
            },
            updateEditor: function (fileInfo) {
                if (!fileInfo) {
                    return;
                }

                $log.info("Updating editor", fileInfo);

                var session = new EditSession(fileInfo.content);

                session.on('change', function () {
                    if (doc && doc.info) {
                        //doc.dirty = true;
                        doc.info.content = session.getValue();
                        $rootScope.$apply();
                    }
                });

                session.$breakpointListener = function (e) {
                    if (!doc.info && !doc.info.syncNotesVideo)
                        return;
                    var delta = e.data;
                    var range = delta.range;
                    if (range.end.row == range.start.row) {
                        // Removing sync mark if line is now empty
                        if (session.getLine(range.start.row).trim() === '') {
                            service.unsync(session, range.start.row);
                        }
                        else if(!(range.start.row in doc.info.syncNotesVideo)){
                            service.syncLine(session, range.start.row);
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
                    for (var line in doc.info.syncNotesVideo) {
                        var intLine = parseInt(line);
                        if (!isNaN(intLine)) {
                            if (line < firstRow) {
                                shiftedSyncNotesVideo[line] = doc.info.syncNotesVideo[line];
                            }
                            else {
                                var nextLine = parseInt(line) + shift;
                                shiftedSyncNotesVideo[nextLine] = doc.info.syncNotesVideo[line];
                            }
                        }
                    }
                    shiftedSyncNotesVideo.enabled = doc.info.syncNotesVideo.enabled;
                    doc.info.syncNotesVideo = shiftedSyncNotesVideo;

                    service.updateBreakpoints(session);
                }.bind(session);
                session.on("change", session.$breakpointListener);

                session.getSelection().on('changeCursor', function (e) {
                    var lineCursorPosition = editor.getCursorPosition().row,
                        timestamp = doc.info.syncNotesVideo[lineCursorPosition];

                    if (session.getLine(lineCursorPosition).trim() !== '') {
                        if (lineCursorPosition != service.lastRow) {
                            service.lastRow = lineCursorPosition;
                            if (timestamp) {
                                $log.info('Timestamp', lineCursorPosition, timestamp);
                                if (timestamp > -1 && doc.info.syncNotesVideo.enabled) {
                                    if (youtubePlayerApi.player) {
                                        youtubePlayerApi.player.seekTo(timestamp);
                                    }
                                    else if (video.player) {
                                        video.player.currentTime = timestamp;
                                    }
                                }
                            }
                            else {
                                $log.info('No timestamp');
                            }
                        }
                    }
                });


                doc.lastSave = 0;
                doc.info = fileInfo;

                this.updateBreakpoints(session);

                editor.setSession(session);
                editor.setReadOnly(!doc.info.editable);
                session.setUseWrapMode(true);
                session.setWrapLimitRange(80);
                editor.focus();
            },
            updateBreakpoints: function (session) {
                if (session && doc.info) {
                    session.clearBreakpoints();
                    for (var line in doc.info.syncNotesVideo) {
                        if (doc.info.syncNotesVideo[line] > -1)
                            session.setBreakpoint(line);
                    }
                }
            },
            syncLine: function(session, line) {
                // Is there a video loaded?
                if (doc.info && doc.info.syncNotesVideo && doc.info.video) {
                    $log.info('Video loaded');
                    // Is there some texts before and after?
                    var timestampBefore, isLineBefore = false,
                        timestampAfter, isLineAfter = false;

                    session.setBreakpoint(line);

                    for (var lineSynced in doc.info.syncNotesVideo) {
                        if (!isLineBefore && lineSynced < line) {
                            isLineBefore = true;
                            timestampBefore = doc.info.syncNotesVideo[line];
                        }
                        else if (!isLineAfter && lineSynced > line) {
                            isLineAfter = true;
                            timestampAfter = doc.info.syncNotesVideo[line];
                        }

                        if (isLineBefore && isLineAfter) {
                            break;
                        }
                    }

                    if (isLineBefore && isLineAfter) {
                        // Text before and after
                        // Timestamp for this line must be average time between nearest line before/after
                        doc.info.syncNotesVideo[line] = (timestampBefore + timestampAfter) / 2;
                    }
                    else {
                        // No text or only before / after
                        // Using current player time
                        if (youtubePlayerApi.player) {
                            doc.info.syncNotesVideo[line] = youtubePlayerApi.player.getCurrentTime() || 0.01;
                        }
                        else if (video.player) {
                            doc.info.syncNotesVideo[line] = video.player.currentTime || 0.01;
                        }
                    }
                    $log.info('Setting timestamp', line, doc.info.syncNotesVideo[line]);
                }
                // No video => mark it anyway, don't want to sync this line
                else {
                    $log.info('No video');
                    doc.info.syncNotesVideo[line] = -1
                }
            },
            unsync: function (session, line) {
                if(doc.info && doc.info.syncNotesVideo && line in doc.info.syncNotesVideo) {
                    session.clearBreakpoint(line);
                    delete doc.info.syncNotesVideo[line];
                }
            },
            state: function () {
                if (this.loading) {
                    return EditorState.LOAD;
                } else if (this.saving) {
                    return EditorState.SAVE;
                } else if (doc.dirty) {
                    return EditorState.DIRTY;
                } else if (doc.info && !doc.info.editable) {
                    return EditorState.READONLY;
                }
                return EditorState.CLEAN;
            }
        };

        return service;
    }]);

module.factory('backend',
    ['$http', '$log', function ($http, $log) {
        var jsonTransform = function (data, headers) {
            return angular.fromJson(data);
        };
        var service = {
            courses: function () {
                return $http.get('/courses')
            },
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
                    method: fileInfo.id ? 'PUT' : 'POST',
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

module.factory('course', ['backend', function (backend) {
    var _this = this;
    this.templateId = null;

    return {
        list: function () {
            return backend.courses();
        },
        setTemplateId: function (templateId) {
            _this.templateId = templateId;
        },
        getTemplateId: function () {
            return _this.templateId;
        }
    }
}]);

module.factory('user', ['$rootScope', 'backend', function ($rootScope, backend) {
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
                $rootScope.$broadcast('authentified', _this);
            });

            return promise;
        }
    };
}]);

module.factory('autosaver',
    ['$rootScope', 'editor', 'doc', 'saveInterval', '$timeout', function ($rootScope, editor, doc, saveInterval, $timeout) {
        var confirmOnLeave = function(e) {
            var msg = "You have unsaved data.";

            // For IE and Firefox
            e = e || window.event;
            if (e) {e.returnValue = msg;}

            // For Chrome and Safari
            return msg;
        };

        var scope = $rootScope.$new(true);
        scope.doc = doc;
        scope.$watch('doc.dirty', function (newValue, oldValue) {
            if(newValue !== oldValue) {
                newValue ? $(window).on('beforeunload', confirmOnLeave) : $(window).off('beforeunload', confirmOnLeave);
            }
        });

        var saveFn = function () {
            if (editor.state() == EditorState.DIRTY) {
                editor.save(false);
            }
        };

        var createTimeout = function () {
            return $timeout(saveFn, saveInterval).then(createTimeout);
        };
        return createTimeout();
    }]);