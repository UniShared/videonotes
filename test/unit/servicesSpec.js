'use strict';

/* jasmine specs for services go here */

describe('service', function() {
    beforeEach(angular.mock.module('app.services'));

    afterEach(inject(function($httpBackend) {
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    }));
});
