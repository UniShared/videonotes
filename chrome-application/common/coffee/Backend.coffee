class Backend
    create: (title) ->
        @info = {
            version: 2
            content: ""
            currentVideo: null
            videos: {}
            syncNotesVideo: true
            labels:
              starred: false
            editable: true
            title: title or "Untitled notes"
            description: ""
            mimeType: "application/vnd.unishared.document"
            parent: null
        }
        return

    load: (id) ->
        console.log "Load file", id
        promise = $.get ConfigSingleton.get().config.BASE_URL + '/svc', {file_id: id}
        promise.done (result) =>
           @info = result
        promise.fail (result) =>
            @info = id: id
            if result.status == 401
                @_handle401()

        return promise

    save: ->
        promise = $.ajax(
            type: if @info.id then "PUT" else "POST"
            url: ConfigSingleton.get().config.BASE_URL + "/svc"
            params:
                newRevision: true
            data: JSON.stringify(@.info)
            contentType: "application/json; charset=utf-8"
            dataType: "json"
        )

        promise.done (result) =>
            console.log "saved", result.id

            if not @info.id
                url = @_updateQueryString('videonotes_start', 1)
                url = @_updateQueryString('videonotes_id', result.id, url)
                window.history.pushState(null, "", url)
                
            @info.id = result.id
            return

        promise.fail (result) =>
            if result.status == 401
                @_handle401()

        return promise

    _handle401: ->
        redirectUrl = ConfigSingleton.get().config.BASE_URL + '/auth' + '?next=' + encodeURIComponent(window.location.href)
        if @info and @info.id
          redirectUrl += '&file_id='+@info.id
          
        location.href = redirectUrl

    _updateQueryString: (key, value, url) ->
        url = window.location.href  unless url
        re = new RegExp("([?|&])" + key + "=.*?(&|#|$)(.*)", "gi")

        if re.test(url)
            url.replace(re, "$1$3").replace /(&|\?)$/, ""  unless typeof value isnt "undefined" and value isnt null
        else
            if typeof value isnt "undefined" and value isnt null
              separator = (if url.indexOf("?") isnt -1 then "&" else "?")
              hash = url.split("#")
              url = hash[0] + separator + key + "=" + value
              url += "#" + hash[1]  if hash[1]
              return url
            else
              return url
