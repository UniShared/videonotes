//Copyright (C) 2013 UniShared Inc.
//
//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

/* Filters */

angular.module('app.filters', [])
    .filter('saveStateFormatter',
    function () {
        return function (state) {
            if (state == EditorState.DIRTY) {
                return 'You have unsaved changes';
            } else if (state == EditorState.SAVE) {
                return 'Saving in Google Drive...';
            } else if (state == EditorState.LOAD) {
                return 'Loading...';
            } else if (state == EditorState.READONLY) {
                return "Read only"
            } else {
                return 'Video and notes saved in Google Drive';
            }
        };
    })
    .filter('bytes',
    function () {
        return function (bytes) {
            bytes = parseInt(bytes);
            if (isNaN(bytes)) {
                return "...";
            }
            var units = [' bytes', ' KB', ' MB', ' GB', ' TB', ' PB', ' EB', ' ZB', ' YB'];
            var p = bytes > 0 ? Math.floor(Math.log(bytes) / Math.LN2 / 10) : 0;
            var u = Math.round(bytes / Math.pow(2, 10 * p));
            return u + units[p];
        }
    });

