'use strict';

/* jasmine specs for controllers go here */

describe('Controllers', function () {
    beforeEach(angular.mock.module('app'));

    describe('VideoCtrl', function () {
        var videoCtrl, scope;

        beforeEach(inject(function ($rootScope, $controller) {
            scope = $rootScope.$new();
            videoCtrl = $controller(VideoCtrl, {$scope: scope});
        }));

        it('should have a VideoCtrl controller', function () {
            expect(videoCtrl).not.toEqual(null);
        });
    });
});