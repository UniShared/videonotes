var _gaq = _gaq || [];

angular.module('analytics', ['ng']).run(function() {
    var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);
}).service('analytics', function($rootScope, $window, $location, $routeParams, $log) {
    var _this = this;

	$rootScope.$on('$viewContentLoaded', track);

	var track = function() {
		var path = convertPathToQueryString($location.path(), $routeParams);
		$window._gaq.push(['_trackPageview', path]);
	};
	
	var convertPathToQueryString = function(path, $routeParams) {
		for (var key in $routeParams) {
			var queryParam = '/' + $routeParams[key];
			path = path.replace(queryParam, '');
		}

		var querystring = decodeURIComponent($.param($routeParams));

		if (querystring === '') return path;

		return path + "?" + querystring;
	};

    $rootScope.$on('configLoaded', function (event, config) {
        _gaq.push(['_setAccount', config.googleAnalyticsAccount]);
        _gaq.push(['_trackPageview']);

        _this.appName = config.appName;
    });

    this.pushAnalytics = function (category, event) {
        if(category) {
            if(event) {
                $log.info('Tracking event to Google Analytics', category, event);
                $window._gaq.push(['_trackEvent', this.appName, category, event]);
            }
            else {
                $log.info('Tracking event to Google Analytics', category);
                $window._gaq.push(['_trackEvent', this.appName, category]);
            }
        }
    };
});
