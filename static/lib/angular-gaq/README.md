# Tracking Google Analytics Page Views with Angular.js

## How?

follow these step:

- Set 'YOUR GOOGLE ACCOUNT' in googleanalyticis.js placeholder with your google account id
- Add the service to your angular js app module:

	``var app = angular.module('myapp', ['analytics']) {
		...
	});``


- Now just have analytics to be injected in your contorller.

	``function myCtrl($rootScope, $scope, $http, analytics) {
	    ...
	};``
