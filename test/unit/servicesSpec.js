'use strict';

/* jasmine specs for services go here */

describe('service', function() {
    beforeEach(function () {
        angular.module('saveIntervalMock', []).constant('saveInterval', function () { return 0; });
        angular.mock.module('app.services', 'youtube', 'analytics', 'saveIntervalMock');
    });

    describe('config', function () {
        it('should have a load method', inject(function (config){
            expect(config.load).toBeDefined();
        }));

        it('should call the config endpoint on load call', inject(function ($httpBackend, config) {
            var response = {googleAnalyticsAccount:'test'};
            $httpBackend.expectGET('/config').respond(200, response);

            config.load();

            $httpBackend.flush();
        }));
    });

    describe('autosaver', function () {
        it('should check document state each $saveInterval seconds', inject(function ($timeout, autosaver) {
            spyOn(autosaver, 'saveFn');
            $timeout.flush();
            waitsFor(function() {
                expect(autosaver.saveFn).toHaveBeenCalled();
            }, "Spreadsheet calculation never completed", 10000);
        }));

        it('should have a confirmOnLeave method which is returning a message', inject(function (doc, autosaver) {
            expect(typeof autosaver.confirmOnLeave).toBe('function');
            var msgExpected = "You have unsaved data.",
                msgReturned = autosaver.confirmOnLeave();
            expect(msgExpected).toEqual(msgReturned);
        }));

        it('should listen to beforeunload event', inject(function ($window, autosaver, doc) {
            spyOn($window, 'addEventListener');
            doc.dirty = true;
            autosaver.$apply();

            console.log($window.addEventListener.mostRecentCall);
            var msg = $window.addEventListener.mostRecentCall.args[1]({});

            expect(msg).toBeEqual("You have unsaved data.");
        }));
    });

    afterEach(inject(function($httpBackend) {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    }));
});
