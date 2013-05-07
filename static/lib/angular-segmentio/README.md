# Tracking Events and Pageviews with Segment.io

## How?

follow these step:

- Add the service to your angular js app module:

	``var app = angular.module('myapp', ['segmentio']) {
		...
	});``


- Now just have analytics to be injected in your controller.

	``function myCtrl($rootScope, $scope, $http, segmentio) {
	    ...
	};``

- Call any method documented here: https://segment.io/libraries/analytics.js
