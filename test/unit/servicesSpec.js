'use strict';

/* jasmine specs for services go here */

describe('service', function() {
    beforeEach(angular.mock.module('app.services'));

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

    afterEach(inject(function($httpBackend) {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    }));
});
