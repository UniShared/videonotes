'use strict';

var module = angular.module('app.services', [], function($locationProvider) {
    $locationProvider.html5Mode(true);
});

var ONE_HOUR_IN_MS = 1000 * 60 * 60;

// Http interceptor for error 401 (authorization)
module.factory('httpInterceptor401', function($q, $location) {
    return function (promise) {
        return promise.then(function (response) {
            // do something on response 401
            return response;
        }, function(response) {
            if(response.status === 401){
                window.location.href = response.data.redirectUri;
            }
            else {
                return $q.reject(response);
            }
        });
    };
});

module.config(function ($httpProvider) {
    $httpProvider.responseInterceptors.push('httpInterceptor401');
});

// Shared model for current document
module.factory('doc',
    function ($rootScope) {
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
    });

module.factory('video', function($log) {
    return {
        player: null,
        bindVideoPlayer:function (element) {
            this.player = element;
        }
    };
});

module.factory('editor',
    function (doc, backend, youtubePlayerApi, video, $q, $rootScope, $log) {
        var editor = null;
        var EditSession = require("ace/edit_session").EditSession;

        var service = {
            loading:false,
            saving:false,
            lastRow: -1,
            rebind:function (element) {
                editor = ace.edit(element);
                this.updateEditor(doc.info);
            },

            snapshot:function () {
                doc.dirty = false;
                var data = angular.extend({}, doc.info);
                if (doc.info.editable) {
                    data.content = doc.info.content;
                }
                return data;
            },
            create:function (parentId) {
                $log.info("Creating new doc");
                doc.dirty = true;
                this.updateEditor({
                    id:null,
                    content: '',
                    video: null,
                    syncNotesVideo: {},
                    labels:{
                        starred:false
                    },
                    editable:true,
                    title:'Your notes',
                    description:'',
                    mimeType:'application/vnd.unishared.document',
                    parent: parentId || null
                });
                this.save(true);
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
                        action:'copy',
                        message:"An error occurred while copying the template"
                    });
                }));
            },
            load:function (id, reload) {
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
                            action:'load',
                            message:"An error occured while loading the file"
                        });
                        return result;
                    }));
            },
            save:function (newRevision) {
                $log.info("Saving file", newRevision);
                if (this.saving || this.loading) {
                    throw 'Save called from incorrect state';
                }
                this.saving = true;
                var file = this.snapshot();

                if(!doc.info.id) {
                    $rootScope.$broadcast('firstSaving');
                }

                // Force revision if first save of the session
                newRevision = newRevision || doc.timeSinceLastSave() > ONE_HOUR_IN_MS;
                var promise = backend.save(file, newRevision);
                promise.then(angular.bind(this,
                    function (result) {
                        $log.info("Saved file", result);
                        this.saving = false;

                        if(!doc.info.id) {
                            doc.info.id = result.data.id;
                            $rootScope.$broadcast('firstSaved', doc.info);
                        }

                        doc.lastSave = new Date().getTime();
                        $rootScope.$broadcast('saved', doc.info);
                        return doc.info;
                    }), angular.bind(this,
                    function (result) {
                        this.saving = false;
                        doc.dirty = true;
                        $rootScope.$broadcast('error', {
                            action:'save',
                            message:"An error occurred while saving the file"
                        });
                        return result;
                    }));
                return promise;
            },
            updateEditor:function (fileInfo) {
                if(!fileInfo) {
                    return;
                }

                $log.info("Updating editor", fileInfo);

                var session = new EditSession(fileInfo.content);

                session.on('change', function () {
                    if(doc && doc.info) {
                        doc.dirty = true;
                        doc.info.content = session.getValue();
                        $rootScope.$apply();
                    }
                });

                session.getSelection().on('changeCursor', function () {
                    var lineCursorPosition = editor.getCursorPosition().row,
                        timestamp = doc.info.syncNotesVideo[lineCursorPosition];

                    if(session.getLine(lineCursorPosition) != '') {
                        if(lineCursorPosition != service.lastRow) {
                            service.lastRow = lineCursorPosition;
                            if(timestamp) {
                                if(youtubePlayerApi.player) {
                                    youtubePlayerApi.player.seekTo(timestamp);
                                }
                                else if(video.player) {
                                    video.player.currentTime = timestamp;
                                }
                            }
                            else {
                                // Is there some texts before and after?
                                var timestampBefore, lineBefore = false,
                                    timestampAfter, lineAfter = false;
                                for(var line in doc.info.syncNotesVideo) {
                                    if (!lineBefore && line < lineCursorPosition) {
                                        lineBefore = true;
                                        timestampBefore = doc.info.syncNotesVideo[line];
                                    }
                                    else if (!lineAfter && line > lineCursorPosition) {
                                        lineAfter = true;
                                        timestampAfter = doc.info.syncNotesVideo[line];
                                    }

                                    if(lineBefore && lineAfter) {
                                        break;
                                    }
                                }

                                if(lineBefore && lineAfter) {
                                    // Text before and after
                                    // Timestamp for this line must be average time between nearest line before/after
                                    doc.info.syncNotesVideo[lineCursorPosition] = (timestampBefore + timestampAfter) / 2;
                                }
                                else {
                                    // No text or only before / after
                                    // Using current player time
                                    if(youtubePlayerApi.player) {
                                        doc.info.syncNotesVideo[lineCursorPosition] = youtubePlayerApi.player.getCurrentTime();
                                    }
                                    else if(video.player) {
                                        doc.info.syncNotesVideo[lineCursorPosition] = video.player.currentTime;
                                    }

                                    session.setBreakpoint(lineCursorPosition);
                                }

                            }
                        }
                    }
                });

                editor.on("gutterclick", function(e){
                    var lineCursorPosition = e.getDocumentPosition().row,
                        timestamp = doc.info.syncNotesVideo[lineCursorPosition];

                    if(youtubePlayerApi.player) {
                        youtubePlayerApi.player.seekTo(timestamp);
                    }
                    else if(video.player) {
                        video.player.currentTime = timestamp;
                    }
                });

                for(var line in fileInfo.syncNotesVideo) {
                    session.setBreakpoint(line);
                }

                /*var dom = require("../lib/dom");
                require("ace/layer/gutter").Gutter.prototype.update = function(config) {
                    var emptyAnno = {className: ""};
                    var html = [];
                    var i = config.firstRow;
                    var lastRow = config.lastRow;
                    var fold = this.session.getNextFoldLine(i);
                    var foldStart = fold ? fold.start.row : Infinity;
                    var foldWidgets = this.$showFoldWidgets && this.session.foldWidgets;
                    var breakpoints = this.session.$breakpoints;
                    var decorations = this.session.$decorations;
                    var firstLineNumber = this.session.$firstLineNumber;
                    var lastLineNumber = 0;

                    while (true) {
                        if(i > foldStart) {
                            i = fold.end.row + 1;
                            fold = this.session.getNextFoldLine(i, fold);
                            foldStart = fold ?fold.start.row :Infinity;
                        }
                        if(i > lastRow)
                            break;

                        var annotation = this.$annotations[i] || emptyAnno;
                        html.push(
                            "<div class='ace_gutter-cell ",
                            breakpoints[i] || "", decorations[i] || "", annotation.className,
                            "' style='height:", this.session.getRowLength(i) * config.lineHeight, "px;'>",
                            doc.info.syncNotesVideo[i + firstLineNumber]
                        );

                        if (foldWidgets) {
                            var c = foldWidgets[i];
                            // check if cached value is invalidated and we need to recompute
                            if (c == null)
                                c = foldWidgets[i] = this.session.getFoldWidget(i);
                            if (c)
                                html.push(
                                    "<span class='ace_fold-widget ace_", c,
                                    c == "start" && i == foldStart && i < fold.end.row ? " ace_closed" : " ace_open",
                                    "' style='height:", config.lineHeight, "px",
                                    "'></span>"
                                );
                        }

                        html.push("</div>");

                        i++;
                    }

                    this.element = dom.setInnerHtml(this.element, html.join(""));
                    this.element.style.height = config.minHeight + "px";

                    if (this.session.$useWrapMode)
                        lastLineNumber = this.session.getLength();

                    var gutterWidth = ("" + lastLineNumber).length * config.characterWidth;
                    var padding = this.$padding || this.$computePadding();
                    gutterWidth += padding.left + padding.right;
                    if (gutterWidth !== this.gutterWidth) {
                        this.gutterWidth = gutterWidth;
                        this.element.style.width = Math.ceil(this.gutterWidth) + "px";
                        this._emit("changeGutterWidth", gutterWidth);
                    }
                };*/


                doc.lastSave = 0;
                doc.info = fileInfo;
                editor.setSession(session);
                editor.setReadOnly(!doc.info.editable);
                session.setUseWrapMode(true);
                session.setWrapLimitRange(80);
                editor.focus();
            },
            state:function () {
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
    });

module.factory('backend',
    function ($http, $log) {
        var jsonTransform = function (data, headers) {
            return angular.fromJson(data);
        };
        var service = {
            courses: function() {
                return $http.get('/courses')
            },
            user:function () {
                return $http.get('/user');
            },
            about:function () {
                return $http.get('/about');
            },
            copy: function(templateId) {
                return $http.post('/svc', {
                    templateId:templateId
                });
            },
            load:function (id) {
                return $http.get('/svc', {
                    params:{
                        'file_id':id
                    }
                });
            },
            save:function (fileInfo, newRevision) {
                $log.info('Saving', fileInfo);
                return $http({
                    url:'/svc',
                    method:fileInfo.id ? 'PUT' : 'POST',
                    headers:{
                        'Content-Type':'application/json'
                    },
                    params:{
                        'newRevision':newRevision
                    },
                    data:JSON.stringify(fileInfo)
                });
            }
        };
        return service;
    });

module.factory('course', function(backend) {
    var _this = this;
    this.templateId = null;

    return {
        list: function () {
            return backend.courses();
        },
        setTemplateId: function(templateId) {
            _this.templateId = templateId;
        },
        getTemplateId: function() {
            return _this.templateId;
        }
    }
});

module.factory('user', function($rootScope, backend) {
    var _this = this;
    this.authenticated = false;
    this.info = null;

    return {
        isAuthenticated: function() {
            return _this.authenticated;
        },
        getInfo: function() {
            return _this.info;
        },
        login: function() {
            backend.user().then(function (response) {
                _this.authenticated = true;
                _this.info = response.data;
                $rootScope.$broadcast('authentified', _this);
            });
        }
    };
});

module.factory('autosaver',
    function (editor, saveInterval, $timeout) {
        var saveFn = function () {
            if (editor.state() == EditorState.DIRTY) {
                editor.save(false);
            }
        };
        var createTimeout = function () {
            return $timeout(saveFn, saveInterval).then(createTimeout);
        }
        return createTimeout();
    });
