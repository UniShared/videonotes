class YoutubePlayer
  @YT_REGEX:/https:\/\/www.youtube.com\/embed\/([a-zA-Z0-9_-]{11})/

  constructor: ->

    window.addEventListener "message", ((event) =>
      data = JSON.parse(event.data)
      if data.event == "infoDelivery"
          if data.info.currentTime
            @currentTime = data.info.currentTime 
          if data.info.videoData and data.info.videoData.video_id
            @currentVideoURL = 'www.youtube.com/watch?v=' + data.info.videoData.video_id               
      )

  getCurrentVideoURL: ->
    iframes = document.getElementsByTagName('iframe')
    for iframe in iframes
      src = iframe.getAttribute('src')
      if src and src.match(@constructor.YT_REGEX)
        return @currentVideoURL
        break

    null