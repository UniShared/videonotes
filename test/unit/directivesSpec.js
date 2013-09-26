// Copyright (C) 2013 UniShared Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// __author__ = 'arnaud@videonot.es (Arnaud BRETON)'
'use strict';

/* jasmine specs for directives go here */

describe('directives', function () {
    var elm, scope;
    beforeEach(angular.mock.module('app.directives', 'app.services', 'segmentio'));

    describe('aceEditor', function () {
        beforeEach(angular.mock.inject(function ($rootScope, $compile) {
            elm = angular.element('<div id="editor" ace-editor sync="sync"></div>');

            scope = $rootScope;
            scope.sync = null;
            $compile(elm)(scope);

            scope.$digest();
        }));

        it('Enabling sync should enable ace gutter', function () {
            var aceGutter = elm.find('.ace_gutter');

            scope.sync = true;
            scope.$apply();

            expect(aceGutter).not.toHaveClass('inactive');
        });

        it('Disabling sync should disable ace gutter', function () {
            var aceGutter = elm.find('.ace_gutter');

            scope.sync = false;
            scope.$apply();

            expect(aceGutter).toHaveClass('inactive');
        });

        it('Toggling sync should toggle ace gutter activation',function () {
            var aceGutter = elm.find('.ace_gutter');

            scope.sync = false;
            scope.$apply();

            expect(aceGutter).toHaveClass('inactive');

            scope.sync = true;
            scope.$apply();

            expect(aceGutter).not.toHaveClass('inactive');
        });
    });

    describe('star', function () {
        beforeEach(angular.mock.inject(function ($rootScope, $compile) {
            elm = angular.element('<star val="star"></star>');

            scope = $rootScope;
            scope.star = false;
            $compile(elm)(scope);


            scope.$digest();
        }));

        it('should change scope.val value when click', function () {
            expect(scope.star).toBe(false);
            elm.click();
            expect(scope.star).toBe(true);
            elm.click();
            expect(scope.star).toBe(false);
        });
    });

    describe('alert', function () {
        beforeEach(angular.mock.inject(function ($rootScope, $compile, segmentio) {
            elm = angular.element('<alert></alert>');

            scope = $rootScope;
            scope.star = false;
            $compile(elm)(scope);

            scope.$digest();

            segmentio.track = jasmine.createSpy();
        }));

        it('should react to error event', angular.mock.inject(function (segmentio) {
            var data = {message: 'test'};
            scope.$broadcast('error', data);

            expect(segmentio.track).toHaveBeenCalledWith('Error', {message:data.message});
            expect(scope.message).toEqual(data.message);
            expect(elm).toHaveAttr('style','display: block;');
        }));

        it('should call close method on close element click', function () {
            scope.close = jasmine.createSpy();
            elm.find('.close').click();
            expect(scope.close).toHaveBeenCalled();
            expect(elm).toBeHidden();
        })
    });

    describe('bootstrapSwitch', function () {
        beforeEach(angular.mock.inject(function ($rootScope, $compile) {
            elm = angular.element('<bootstrap-switch property="val"></bootstrap-switch>');

            scope = $rootScope;
            scope.val = null;
            $compile(elm)(scope);

            scope.$digest();
        }));

        it('should react to switch-change event', function () {
            expect(scope.val).toEqual(null);
            $(elm).trigger('switch-change', {value: true});
            expect(scope.val).toEqual(true);
        });

        it('should watch property', function () {
            scope.val = true;

            scope.$apply();

            expect($(elm).bootstrapSwitch('status')).toBe(true);

            scope.val = false;
            scope.$apply();

            expect($(elm).bootstrapSwitch('status')).toBe(false);
        });
    })
});
