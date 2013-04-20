'use strict';

/* jasmine specs for services go here */

describe('service', function() {
    beforeEach(function () {
        angular.module('appMock', [])
            .constant('saveInterval', function () { return 0; })
            .constant('appName', "VideoNotes test");
        angular.mock.module('app.services', 'youtube', 'analytics', 'appMock');
    });

    describe('config', function () {
        it('should have a load method', inject(function (config){
            expect(config.load).toBeDefined();
        }));

        it('should call the config endpoint on load call', inject(function ($httpBackend, config, appName) {
            var response = {googleAnalyticsAccount:'test', appId: '1234'};
            $httpBackend.expectGET('/config').respond(200, response);

            config.load();

            $httpBackend.flush();
        }));
    });

    describe('autosaver', function () {
        it('should check document state each $saveInterval seconds', inject(function ($timeout, autosaver) {
            spyOn(autosaver, 'saveFn');
            $timeout.flush();
            expect(autosaver.saveFn).toHaveBeenCalled();
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

            var msg = $window.addEventListener.mostRecentCall.args[1]({});

            expect(msg).toBeEqual("You have unsaved data.");
        }));
    });

    afterEach(inject(function($httpBackend) {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    }));
});
