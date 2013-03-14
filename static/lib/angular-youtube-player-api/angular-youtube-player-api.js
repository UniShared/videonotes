angular.module('youtubePlayerApi', ['ng']).run(function () {
    var tag = document.createElement('script');

    // This is a protocol-relative URL as described here:
    //     http://paulirish.com/2010/the-protocol-relative-url/
    // If you're testing a local page accessed via a file:/// URL, please set tag.src to
    //     "https://www.youtube.com/iframe_api" instead.
    tag.src = "//www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
})
    .service('youtubePlayerApi', function ($window, $rootScope) {
        var service = $rootScope.$new(true);

        $window.onYouTubeIframeAPIReady = function () {
            service.ready = true;
        };

        service.ready = false;
        service.registered = false;
        service.player = null;
        service.videoId = null;

        service.loadPlayer = function () {
            if (service.ready) {
                if(service.player) {
                    service.player.destroy();
                }
                service.player = new YT.Player('ytplayer', {
                    height: '390',
                    width: '640',
                    videoId: service.videoId
                });
            }
        };

        //service.$watch('videoId', service.loadPlayer);

        return service;
    });