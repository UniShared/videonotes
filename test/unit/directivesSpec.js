'use strict';

/* jasmine specs for directives go here */

describe('directives', function () {
    var elm, scope;
    beforeEach(angular.mock.module('app.directives', 'app.services', 'segmentio'));

    beforeEach(angular.mock.inject(function(backend) {
        spyOn(backend, "init");
    }));

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
